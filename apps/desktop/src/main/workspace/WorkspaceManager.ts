import * as path from "path";
import * as fs from "fs/promises";
import type { Dirent } from "fs";
import { app, shell } from "electron";
import chokidar, { type FSWatcher } from "chokidar";
import { IgnoreEngine } from "./IgnoreEngine.js";

/**
 * Spec 022 v3 — workspace folder binding manager.
 *
 * Per-room binding store, file tree cache, watcher, and on-demand
 * single-file reader. The renderer's useMessageInterceptor calls
 * `readFile()` when a user message references a workspace path; the
 * file then rides the chat as a Matrix-native attachment / inline
 * code block.
 *
 * Deliberately minimal compared to v2 — no access log, no notify
 * tracker, no read/list request dispatch. The renderer drives all
 * file output; this module just answers "give me this file" and
 * keeps the cached file tree fresh.
 */

export interface FileEntry {
  path: string;
  size: number;
  mtime: number;
}

export interface ScanResult {
  fileCount: number;
  totalSize: number;
  ignoredCount: number;
  files: FileEntry[];
  truncated: boolean;
}

export interface Binding {
  roomId: string;
  localPath: string;
  displayName: string;
  boundBy: string;
  boundAt: number;
  fileCount: number;
  totalSize: number;
  ignorePatterns: string[];
  /** Spec §3.6 — when off, useMessageInterceptor only attaches files
   *  the user *explicitly* picked via 📁; auto-detection from text
   *  is skipped. */
  autoAttach: boolean;
}

export interface ReadResult {
  ok: boolean;
  /** base64-encoded file bytes — IPC can't ferry a Buffer directly. */
  contentBase64?: string;
  encoding?: "utf-8" | "base64";
  size?: number;
  mtime?: number;
  isText?: boolean;
  error?: string;
}

export type BindingChangedHandler = (
  roomId: string,
  binding: Binding | null,
  files: FileEntry[],
) => void;

export class WorkspaceManager {
  private bindings = new Map<string, Binding>();
  private fileTrees = new Map<string, FileEntry[]>();
  private watchers = new Map<string, FSWatcher>();
  private storageFile: string;
  private onBindingChanged: BindingChangedHandler;

  // Spec §6.4 — defaults block secrets, build artifacts, and VCS noise.
  // Users can layer their own `.magicignore` on top.
  private readonly DEFAULT_IGNORES = [
    "node_modules/**",
    ".git/**",
    ".svn/**",
    ".hg/**",
    "dist/**",
    "build/**",
    "out/**",
    "target/**",
    "__pycache__/**",
    ".venv/**",
    "venv/**",
    ".env",
    ".env.*",
    "*.envrc",
    "*.log",
    "*.tmp",
    "*.cache",
    ".DS_Store",
    "Thumbs.db",
    ".idea/**",
    ".vscode/**",
    "*.lock",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    ".ssh/**",
    ".aws/**",
    ".gnupg/**",
    ".config/**/credentials*",
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
    "*.jks",
    "*.keystore",
    "id_rsa*",
    "id_ed25519*",
    "id_ecdsa*",
    ".npmrc",
    ".pypirc",
    ".docker/config.json",
    ".kube/config",
  ];

  // Spec §6.1 — main-process hard upper bound. Renderer has its own
  // tighter caps (5 MB auto-attach, 1 MB total per message).
  private readonly MAX_READ_SIZE = 10 * 1024 * 1024;

  // Scan-time guards so a giant tree can't hang the bind flow.
  private readonly MAX_FILE_COUNT = 10000;
  private readonly MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024;

  // chokidar republish debounce — most editors emit 3-5 events per save.
  private readonly RESCAN_DEBOUNCE_MS = 2000;

  constructor(onBindingChanged: BindingChangedHandler) {
    this.storageFile = path.join(
      app.getPath("userData"),
      "magic-workspaces.json",
    );
    this.onBindingChanged = onBindingChanged;
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.storageFile, "utf-8");
      const parsed = JSON.parse(raw) as { bindings?: Record<string, Binding> };
      if (parsed.bindings) {
        for (const [roomId, binding] of Object.entries(parsed.bindings)) {
          // Backfill autoAttach for older payloads where it was absent.
          if (typeof binding.autoAttach !== "boolean") {
            binding.autoAttach = true;
          }
          this.bindings.set(roomId, binding);
        }
      }
    } catch {
      /* fresh install */
    }

    // Restore file watchers + re-scan trees so the in-memory cache is
    // populated before the first IPC call.
    for (const [roomId, binding] of this.bindings.entries()) {
      try {
        await fs.access(binding.localPath);
        const scan = await this.scanFolder(binding.localPath);
        this.fileTrees.set(roomId, scan.files);
        await this.startWatching(roomId, binding);
      } catch {
        console.warn(
          `[workspace] bound path missing on startup: ${binding.localPath}`,
        );
      }
    }
  }

  async shutdown(): Promise<void> {
    for (const watcher of this.watchers.values()) {
      try {
        await watcher.close();
      } catch {
        /* best effort */
      }
    }
    this.watchers.clear();
  }

  private async save(): Promise<void> {
    const data = {
      version: 3,
      bindings: Object.fromEntries(this.bindings.entries()),
    };
    await fs.writeFile(this.storageFile, JSON.stringify(data, null, 2));
  }

  // ---------- public surface called over IPC ----------

  async scanFolder(folderPath: string): Promise<ScanResult> {
    const ignore = new IgnoreEngine(this.DEFAULT_IGNORES);
    try {
      const dotIgnore = await fs.readFile(
        path.join(folderPath, ".magicignore"),
        "utf-8",
      );
      ignore.addPatterns(dotIgnore.split(/\r?\n/));
    } catch {
      /* no .magicignore → defaults only */
    }

    const files: FileEntry[] = [];
    let totalSize = 0;
    let ignoredCount = 0;
    let truncated = false;

    const walk = async (dir: string): Promise<void> => {
      if (truncated) return;
      let entries: Dirent[];
      try {
        entries = (await fs.readdir(dir, { withFileTypes: true })) as Dirent[];
      } catch {
        return;
      }
      for (const entry of entries) {
        if (truncated) break;
        const fullPath = path.join(dir, entry.name);
        const relPath = path
          .relative(folderPath, fullPath)
          .replace(/\\/g, "/");
        if (ignore.matches(relPath)) {
          ignoredCount++;
          continue;
        }
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          try {
            const stat = await fs.stat(fullPath);
            files.push({
              path: relPath,
              size: stat.size,
              mtime: stat.mtimeMs,
            });
            totalSize += stat.size;
            if (
              files.length >= this.MAX_FILE_COUNT ||
              totalSize >= this.MAX_TOTAL_SIZE
            ) {
              truncated = true;
              break;
            }
          } catch {
            /* unreadable — skip */
          }
        }
      }
    };

    await walk(folderPath);

    return {
      fileCount: files.length,
      totalSize,
      ignoredCount,
      files,
      truncated,
    };
  }

  async bind(
    roomId: string,
    folderPath: string,
    boundBy: string,
  ): Promise<{ binding: Binding; files: FileEntry[] }> {
    const stat = await fs.stat(folderPath);
    if (!stat.isDirectory()) {
      throw new Error("选择的不是文件夹");
    }

    if (this.bindings.has(roomId)) {
      await this.unbind(roomId);
    }

    const scan = await this.scanFolder(folderPath);

    const binding: Binding = {
      roomId,
      localPath: folderPath,
      displayName: path.basename(folderPath),
      boundBy,
      boundAt: Date.now(),
      fileCount: scan.fileCount,
      totalSize: scan.totalSize,
      ignorePatterns: this.DEFAULT_IGNORES,
      // Spec §3.6 — auto-attach defaults on; user can flip in settings.
      autoAttach: true,
    };

    this.bindings.set(roomId, binding);
    this.fileTrees.set(roomId, scan.files);
    await this.save();

    // Renderer-side handler picks this up and ships the bind
    // announcement message + state event (§5.2.3).
    this.onBindingChanged(roomId, binding, scan.files);

    await this.startWatching(roomId, binding);

    return { binding, files: scan.files };
  }

  async unbind(roomId: string): Promise<void> {
    const watcher = this.watchers.get(roomId);
    if (watcher) {
      try {
        await watcher.close();
      } catch {
        /* best effort */
      }
      this.watchers.delete(roomId);
    }
    this.bindings.delete(roomId);
    this.fileTrees.delete(roomId);
    await this.save();
    this.onBindingChanged(roomId, null, []);
  }

  getBinding(roomId: string): Binding | null {
    return this.bindings.get(roomId) ?? null;
  }

  getFileTree(roomId: string): FileEntry[] {
    return this.fileTrees.get(roomId) ?? [];
  }

  revealInFinder(roomId: string): void {
    const binding = this.bindings.get(roomId);
    if (binding) shell.openPath(binding.localPath);
  }

  setAutoAttach(roomId: string, enabled: boolean): void {
    const binding = this.bindings.get(roomId);
    if (!binding) return;
    binding.autoAttach = enabled;
    // Fire-and-forget save; the in-memory toggle takes effect
    // immediately and persistence is best-effort.
    this.save().catch(() => {
      /* swallow */
    });
    this.onBindingChanged(
      roomId,
      binding,
      this.fileTrees.get(roomId) ?? [],
    );
  }

  getAutoAttach(roomId: string): boolean {
    return this.bindings.get(roomId)?.autoAttach ?? false;
  }

  /**
   * Spec §5.1.2 — single-file read used by useMessageInterceptor.
   *
   * Three guards: (a) `resolveSafePath` rejects `..` traversal,
   * (b) the per-binding ignore engine blocks anything the user
   * shielded (.env, *.key etc.) even if they explicitly pick it,
   * (c) the per-request size cap is `MAX_READ_SIZE`. Renderer
   * applies tighter limits on top.
   */
  async readFile(roomId: string, relPath: string): Promise<ReadResult> {
    const binding = this.bindings.get(roomId);
    if (!binding) return { ok: false, error: "未绑定" };

    const safe = this.resolveSafePath(binding.localPath, relPath);
    if (!safe) return { ok: false, error: "路径越界" };

    const ignore = new IgnoreEngine(binding.ignorePatterns);
    if (ignore.matches(relPath)) {
      return { ok: false, error: "文件被忽略列表排除" };
    }

    try {
      const stat = await fs.stat(safe);
      if (!stat.isFile()) return { ok: false, error: "不是文件" };
      if (stat.size > this.MAX_READ_SIZE) {
        return { ok: false, error: `文件过大（${stat.size} 字节）` };
      }
      const buf = await fs.readFile(safe);
      const isText = this.detectIsText(buf);
      return {
        ok: true,
        contentBase64: buf.toString("base64"),
        encoding: isText ? "utf-8" : "base64",
        size: buf.length,
        mtime: stat.mtimeMs,
        isText,
      };
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return { ok: false, error: "文件不存在" };
      return { ok: false, error: e.message ?? "读取失败" };
    }
  }

  // ---------- internals ----------

  /** Reject relPath that escapes the binding root. Two-stage: normalize
   *  away `..` segments + require the resolved path to live at-or-
   *  below the root. */
  private resolveSafePath(rootPath: string, relPath: string): string | null {
    const normalized = path.normalize(relPath ?? "").replace(/^[\\/]+/, "");
    if (normalized.split(path.sep).includes("..")) return null;
    const resolved = path.resolve(rootPath, normalized);
    if (
      resolved !== rootPath &&
      !resolved.startsWith(rootPath + path.sep)
    ) {
      return null;
    }
    return resolved;
  }

  private detectIsText(content: Buffer): boolean {
    const sample = content.subarray(0, Math.min(content.length, 8192));
    if (sample.includes(0)) return false;
    try {
      const decoded = sample.toString("utf-8");
      const replacementCount = (decoded.match(/�/g) || []).length;
      return replacementCount <= sample.length * 0.01;
    } catch {
      return false;
    }
  }

  private async startWatching(
    roomId: string,
    binding: Binding,
  ): Promise<void> {
    const ignore = new IgnoreEngine(binding.ignorePatterns);
    const watcher = chokidar.watch(binding.localPath, {
      ignored: (filePath: string) => {
        if (filePath === binding.localPath) return false;
        const rel = path
          .relative(binding.localPath, filePath)
          .replace(/\\/g, "/");
        if (!rel) return false;
        return ignore.matches(rel);
      },
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    let debounceTimer: NodeJS.Timeout | null = null;
    const triggerRescan = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const scan = await this.scanFolder(binding.localPath);
          binding.fileCount = scan.fileCount;
          binding.totalSize = scan.totalSize;
          this.fileTrees.set(roomId, scan.files);
          await this.save();
          // Spec §5.1.2 — v3 only refreshes the cache on watcher
          // events. Notifying renderer keeps the UI's file tree in
          // sync (so the 📁 picker shows newly-added files); we do
          // *not* spam Matrix with a fresh announcement on every
          // change.
          this.onBindingChanged(roomId, binding, scan.files);
        } catch (err) {
          console.error("[workspace] rescan failed:", err);
        }
      }, this.RESCAN_DEBOUNCE_MS);
    };

    watcher.on("add", triggerRescan);
    watcher.on("change", triggerRescan);
    watcher.on("unlink", triggerRescan);
    watcher.on("addDir", triggerRescan);
    watcher.on("unlinkDir", triggerRescan);

    this.watchers.set(roomId, watcher);
  }
}
