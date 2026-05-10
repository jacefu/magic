import * as path from "path";
import * as fs from "fs/promises";
import type { Dirent } from "fs";
import { app, shell, BrowserWindow } from "electron";
import chokidar, { type FSWatcher } from "chokidar";
import { IgnoreEngine } from "./IgnoreEngine.js";

/**
 * Spec 022 — Magic Client's workspace folder binding manager.
 *
 * Holds per-room bindings (the local folder the user picked), serves
 * file-tree scans + on-demand reads to the renderer's Matrix bridge,
 * and watches each bound folder so the published file tree stays
 * fresh. No cloud / no backend — files never leave the local disk.
 *
 * Storage:
 *   - bindings.json  ← per-room { localPath, displayName, … }
 *   - access-log.json ← per-room ring buffer (200 entries, latest first)
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
}

export interface AccessLogEntry {
  timestamp: number;
  type: "read" | "list";
  path: string;
  agentUserId: string;
  bytes: number;
  success: boolean;
}

export interface ReadResult {
  ok: boolean;
  // Returned as a base64 string so it crosses the IPC boundary cleanly
  // (the contextBridge can't serialize a Buffer). Renderer decides how
  // to re-encode for the Matrix payload.
  contentBase64?: string;
  encoding?: "utf-8" | "base64";
  size?: number;
  mtime?: number;
  error?: string;
  errorMessage?: string;
}

export interface ListResult {
  ok: boolean;
  entries?: Array<{
    path: string;
    size: number;
    mtime: number;
    isDirectory: boolean;
  }>;
  error?: string;
  errorMessage?: string;
}

export class WorkspaceManager {
  private bindings = new Map<string, Binding>();
  private watchers = new Map<string, FSWatcher>();
  private accessLogs = new Map<string, AccessLogEntry[]>();
  private storageFile: string;
  private accessLogFile: string;
  private mainWindow: BrowserWindow | null = null;

  // Sane default ignore list — keeps Agents away from secrets, build
  // artifacts, and noise. Users can layer their own `.magicignore` on
  // top of this. Patterns follow glob syntax (minimatch).
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

  // Per-request file size cap. Spec § 6.1 — even if the caller asks
  // for more, this is the hard upper bound.
  private readonly MAX_READ_SIZE = 10 * 1024 * 1024;

  // Scan-time guards so a giant tree can't hang the bind flow forever.
  private readonly MAX_FILE_COUNT = 10000;
  private readonly MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024;

  // chokidar republish debounce — avoid event-storm spam while a save
  // operation is mid-flight (most editors emit 3–5 change events per
  // save).
  private readonly REPUBLISH_DEBOUNCE_MS = 2000;

  constructor() {
    this.storageFile = path.join(
      app.getPath("userData"),
      "magic-workspaces.json",
    );
    this.accessLogFile = path.join(
      app.getPath("userData"),
      "magic-workspace-access-log.json",
    );
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win;
  }

  /**
   * Load persisted bindings + access logs and re-attach watchers. Call
   * once on `app.whenReady()`.
   */
  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.storageFile, "utf-8");
      const parsed = JSON.parse(raw) as { bindings?: Record<string, Binding> };
      if (parsed.bindings) {
        for (const [roomId, binding] of Object.entries(parsed.bindings)) {
          this.bindings.set(roomId, binding);
        }
      }
    } catch {
      /* fresh install — no file yet */
    }

    try {
      const raw = await fs.readFile(this.accessLogFile, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, AccessLogEntry[]>;
      for (const [roomId, log] of Object.entries(parsed)) {
        this.accessLogs.set(roomId, log);
      }
    } catch {
      /* nothing yet */
    }

    for (const [roomId, binding] of this.bindings.entries()) {
      try {
        await fs.access(binding.localPath);
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
        /* best-effort */
      }
    }
    this.watchers.clear();
  }

  private async saveBindings(): Promise<void> {
    const data = {
      version: 1,
      bindings: Object.fromEntries(this.bindings.entries()),
    };
    await fs.writeFile(this.storageFile, JSON.stringify(data, null, 2));
  }

  private async saveAccessLogs(): Promise<void> {
    const data = Object.fromEntries(this.accessLogs.entries());
    await fs.writeFile(this.accessLogFile, JSON.stringify(data));
  }

  // ---------- public surface called from IPC ----------

  async scanFolder(folderPath: string): Promise<ScanResult> {
    const ignore = new IgnoreEngine(this.DEFAULT_IGNORES);
    try {
      const dotMagicIgnore = await fs.readFile(
        path.join(folderPath, ".magicignore"),
        "utf-8",
      );
      ignore.addPatterns(dotMagicIgnore.split(/\r?\n/));
    } catch {
      /* no .magicignore — only defaults apply */
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
            /* unreadable file — skip */
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
  ): Promise<Binding> {
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
    };

    this.bindings.set(roomId, binding);
    await this.saveBindings();

    this.emitFileTreeChanged(roomId, scan.files);
    this.emitBindingChanged(roomId, binding);

    await this.startWatching(roomId, binding);

    return binding;
  }

  async unbind(roomId: string): Promise<void> {
    const watcher = this.watchers.get(roomId);
    if (watcher) {
      try {
        await watcher.close();
      } catch {
        /* best-effort */
      }
      this.watchers.delete(roomId);
    }
    this.bindings.delete(roomId);
    await this.saveBindings();

    // Empty file list signals the bridge to publish `{ bound: false }`.
    this.emitFileTreeChanged(roomId, []);
    this.emitBindingChanged(roomId, null);
  }

  getBinding(roomId: string): Binding | null {
    return this.bindings.get(roomId) ?? null;
  }

  getAllBindings(): Binding[] {
    return Array.from(this.bindings.values());
  }

  revealInFinder(roomId: string): void {
    const binding = this.bindings.get(roomId);
    if (binding) shell.openPath(binding.localPath);
  }

  /**
   * Spec § 5.1.2 — core: serve a single file in response to an
   * Agent's `read_request`. The renderer bridge calls into here and
   * relays the result back over Matrix.
   *
   * Three guards: (a) path normalization rejects `..`/absolute paths,
   * (b) the ignore engine blocks anything the user shielded (.env,
   * keys), (c) the per-request size cap is the smaller of the
   * caller's `maxSize` and `MAX_READ_SIZE`.
   */
  async readFile(
    roomId: string,
    relPath: string,
    maxSize: number,
    requesterId: string,
  ): Promise<ReadResult> {
    const binding = this.bindings.get(roomId);
    if (!binding) {
      this.logAccess(roomId, requesterId, "read", relPath, 0, false);
      return {
        ok: false,
        error: "binding_unbound",
        errorMessage: "对话未绑定文件夹",
      };
    }

    const safe = this.resolveSafePath(binding.localPath, relPath);
    if (!safe) {
      this.logAccess(roomId, requesterId, "read", relPath, 0, false);
      return {
        ok: false,
        error: "permission_denied",
        errorMessage: "路径越界",
      };
    }

    const ignore = new IgnoreEngine(binding.ignorePatterns);
    if (ignore.matches(relPath)) {
      this.logAccess(roomId, requesterId, "read", relPath, 0, false);
      return {
        ok: false,
        error: "permission_denied",
        errorMessage: "文件被忽略列表排除",
      };
    }

    try {
      const stat = await fs.stat(safe);
      if (!stat.isFile()) {
        this.logAccess(roomId, requesterId, "read", relPath, 0, false);
        return {
          ok: false,
          error: "file_not_found",
          errorMessage: "不是文件",
        };
      }
      const cap = Math.min(maxSize || this.MAX_READ_SIZE, this.MAX_READ_SIZE);
      if (stat.size > cap) {
        this.logAccess(roomId, requesterId, "read", relPath, 0, false);
        return {
          ok: false,
          error: "size_exceeded",
          errorMessage: `文件 ${stat.size} 字节超过上限 ${cap}`,
        };
      }
      const buf = await fs.readFile(safe);
      const encoding = this.detectEncoding(buf);
      this.logAccess(roomId, requesterId, "read", relPath, buf.length, true);
      return {
        ok: true,
        contentBase64: buf.toString("base64"),
        encoding,
        size: buf.length,
        mtime: stat.mtimeMs,
      };
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      this.logAccess(roomId, requesterId, "read", relPath, 0, false);
      if (e.code === "ENOENT") {
        return {
          ok: false,
          error: "file_not_found",
          errorMessage: "文件不存在",
        };
      }
      return {
        ok: false,
        error: "permission_denied",
        errorMessage: e.message ?? "读取失败",
      };
    }
  }

  async listDir(
    roomId: string,
    relPath: string,
    depth: number,
    requesterId: string,
  ): Promise<ListResult> {
    const binding = this.bindings.get(roomId);
    if (!binding) {
      return { ok: false, error: "binding_unbound" };
    }
    const safe = this.resolveSafePath(binding.localPath, relPath || "");
    if (!safe) {
      return { ok: false, error: "permission_denied" };
    }
    const ignore = new IgnoreEngine(binding.ignorePatterns);
    const entries: NonNullable<ListResult["entries"]> = [];
    const maxDepth = Math.max(0, Math.min(depth ?? 1, 5));

    const walk = async (dir: string, currentDepth: number): Promise<void> => {
      if (currentDepth > maxDepth) return;
      let items: Dirent[];
      try {
        items = (await fs.readdir(dir, { withFileTypes: true })) as Dirent[];
      } catch {
        return;
      }
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        const itemRel = path
          .relative(binding.localPath, fullPath)
          .replace(/\\/g, "/");
        if (ignore.matches(itemRel)) continue;
        try {
          const stat = await fs.stat(fullPath);
          entries.push({
            path: itemRel,
            size: stat.size,
            mtime: stat.mtimeMs,
            isDirectory: item.isDirectory(),
          });
          if (item.isDirectory() && currentDepth < maxDepth) {
            await walk(fullPath, currentDepth + 1);
          }
        } catch {
          /* skip */
        }
      }
    };

    await walk(safe, 0);
    this.logAccess(roomId, requesterId, "list", relPath, 0, true);
    return { ok: true, entries };
  }

  getAccessLog(roomId: string, limit: number): AccessLogEntry[] {
    const log = this.accessLogs.get(roomId) ?? [];
    return log.slice(-Math.max(1, Math.min(limit || 50, 200))).reverse();
  }

  // ---------- internals ----------

  /**
   * Reject any relPath that escapes the binding root. We normalize
   * away `..` segments + leading slashes, then resolve against the
   * root and require the result to live at-or-below the root path.
   */
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

  /**
   * Heuristic UTF-8 vs binary detection. Buffers with replacement
   * characters or NUL bytes in the first 8KB are treated as binary
   * and base64-encoded for transit; everything else flows as UTF-8.
   */
  private detectEncoding(content: Buffer): "utf-8" | "base64" {
    const sample = content.subarray(0, Math.min(content.length, 8192));
    if (sample.includes(0)) return "base64";
    try {
      const decoded = sample.toString("utf-8");
      const replacementCount = (decoded.match(/�/g) || []).length;
      if (replacementCount > sample.length * 0.01) return "base64";
      return "utf-8";
    } catch {
      return "base64";
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
    const triggerRepublish = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const scan = await this.scanFolder(binding.localPath);
          binding.fileCount = scan.fileCount;
          binding.totalSize = scan.totalSize;
          await this.saveBindings();
          this.emitFileTreeChanged(roomId, scan.files);
          this.emitBindingChanged(roomId, binding);
        } catch (err) {
          console.error("[workspace] republish failed:", err);
        }
      }, this.REPUBLISH_DEBOUNCE_MS);
    };

    watcher.on("add", triggerRepublish);
    watcher.on("change", triggerRepublish);
    watcher.on("unlink", triggerRepublish);
    watcher.on("addDir", triggerRepublish);
    watcher.on("unlinkDir", triggerRepublish);

    this.watchers.set(roomId, watcher);
  }

  private logAccess(
    roomId: string,
    agentUserId: string,
    type: "read" | "list",
    relPath: string,
    bytes: number,
    success: boolean,
  ): void {
    const log = this.accessLogs.get(roomId) ?? [];
    const entry: AccessLogEntry = {
      timestamp: Date.now(),
      type,
      path: relPath,
      agentUserId,
      bytes,
      success,
    };
    log.push(entry);
    if (log.length > 200) log.splice(0, log.length - 200);
    this.accessLogs.set(roomId, log);
    // Best-effort persistence; we don't await so a slow disk doesn't
    // bottleneck the request path.
    this.saveAccessLogs().catch(() => {
      /* swallow */
    });
    this.emitAccessLogged(roomId, entry);
  }

  private emitFileTreeChanged(roomId: string, files: FileEntry[]): void {
    this.broadcast("workspace:file-tree-changed", { roomId, files });
  }

  private emitBindingChanged(
    roomId: string,
    binding: Binding | null,
  ): void {
    this.broadcast("workspace:binding-changed", { roomId, binding });
  }

  private emitAccessLogged(roomId: string, entry: AccessLogEntry): void {
    this.broadcast("workspace:access-logged", { roomId, entry });
  }

  private broadcast(channel: string, payload: unknown): void {
    const target = this.mainWindow ?? BrowserWindow.getAllWindows()[0] ?? null;
    if (target && !target.isDestroyed()) {
      target.webContents.send(channel, payload);
    }
  }
}
