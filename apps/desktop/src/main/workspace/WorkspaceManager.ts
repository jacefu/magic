import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import type { Dirent } from "fs";
import { shell } from "electron";
import chokidar, { type FSWatcher } from "chokidar";
import { IgnoreEngine } from "./IgnoreEngine.js";

/**
 * Spec 022 v6 — workspace context injection manager.
 *
 * Stores binding records + global ignore/system-prompt under
 * `~/.agentteams/` (the App's global home, deliberately *not* in
 * Electron's userData and *not* inside the bound folder itself).
 *
 * Renderer code reaches in for three things on every user message:
 *   1. scanTree(roomId)        — current directory snapshot (5s cache)
 *   2. getSystemContext(roomId) — global agentteams.md + per-binding ctx
 *   3. readFile(roomId, path)   — reactive file projection
 *
 * No file content is cached in this layer — chokidar invalidates the
 * tree cache on add/unlink so the next scan is always fresh, and
 * readFile always hits disk.
 */

export interface Binding {
  roomId: string;
  localPath: string;
  displayName: string;
  boundBy: string;
  boundAt: number;
  /** Per-binding system prompt edited from the App settings panel.
   *  Stored in workspaces.json under this binding — never written
   *  back into the user's bound folder. */
  context?: string;
}

export interface FileNode {
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
}

export interface TreeResult {
  nodes: FileNode[];
  truncated: boolean;
}

export interface SystemContext {
  global: string | null;
  binding: string | null;
}

export interface ReadResult {
  ok: boolean;
  isText?: boolean;
  /** UTF-8 text body when isText. */
  content?: string;
  /** base64 bytes when binary. IPC can't ferry a Buffer directly. */
  base64?: string;
  size?: number;
  mtime?: number;
  error?: string;
}

export type ChangeKind = "bind" | "tree-changed" | "unbind" | "context-changed";

export type BindingChangedHandler = (
  roomId: string,
  binding: Binding | null,
  kind: ChangeKind,
) => void;

export class WorkspaceManager {
  private bindings = new Map<string, Binding>();
  private treeCache = new Map<
    string,
    { nodes: FileNode[]; truncated: boolean; ts: number }
  >();
  private watchers = new Map<string, FSWatcher>();
  private configDir: string;
  private storageFile: string;
  private globalIgnoreFile: string;
  private globalContextFile: string;
  private onChange: BindingChangedHandler;

  // Spec §8 — default ignores: secrets, build artefacts, VCS noise.
  // Layered on top by the global `~/.agentteams/ignore` file (if present).
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

  // Spec §8 — per-file 5 MB cap. Larger files surface a "文件过大" error
  // back to the renderer so the projection layer can fall back to an
  // m.file upload rather than embedding inline.
  private readonly MAX_FILE_READ = 5 * 1024 * 1024;

  // Spec §6.1 — keep tree injections compact; 500 entries cover the
  // vast majority of real-world projects and the LLM context window
  // can't usefully consume more.
  private readonly MAX_TREE_FILES = 500;

  // Cache TTL is short on purpose: chokidar `add`/`unlink` invalidate
  // immediately, so the only thing the TTL guards against is a burst
  // of message sends within the same render frame.
  private readonly TREE_CACHE_TTL = 5000;

  // Spec §8 — single context segment capped at 8 KB so users can't
  // accidentally paste an entire book into the per-binding context
  // field and DoS the LLM.
  private readonly MAX_CONTEXT_LEN = 8 * 1024;

  // chokidar emits 3-5 events per save in most editors; coalesce.
  private readonly RESCAN_DEBOUNCE_MS = 2000;

  constructor(onChange: BindingChangedHandler) {
    this.configDir = path.join(os.homedir(), ".agentteams");
    this.storageFile = path.join(this.configDir, "workspaces.json");
    this.globalIgnoreFile = path.join(this.configDir, "ignore");
    this.globalContextFile = path.join(this.configDir, "agentteams.md");
    this.onChange = onChange;
  }

  async load(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true }).catch(() => {
      /* best effort */
    });
    try {
      const raw = await fs.readFile(this.storageFile, "utf-8");
      const parsed = JSON.parse(raw) as {
        bindings?: Record<string, Binding>;
      };
      for (const [rid, b] of Object.entries(parsed.bindings ?? {})) {
        try {
          await fs.access(b.localPath);
          this.bindings.set(rid, b);
          await this.startWatching(rid, b);
        } catch {
          console.warn(`[workspace] bound path missing: ${b.localPath}`);
        }
      }
    } catch {
      /* fresh install */
    }
  }

  async shutdown(): Promise<void> {
    for (const w of this.watchers.values()) {
      try {
        await w.close();
      } catch {
        /* best effort */
      }
    }
    this.watchers.clear();
  }

  private async save(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true }).catch(() => {
      /* best effort */
    });
    const data = {
      version: 6,
      bindings: Object.fromEntries(this.bindings.entries()),
    };
    await fs.writeFile(this.storageFile, JSON.stringify(data, null, 2));
  }

  // ===== Binding lifecycle =====

  async bind(
    roomId: string,
    localPath: string,
    boundBy: string,
  ): Promise<Binding> {
    const stat = await fs.stat(localPath);
    if (!stat.isDirectory()) throw new Error("选择的不是文件夹");
    if (this.bindings.has(roomId)) await this.unbind(roomId, true);

    const binding: Binding = {
      roomId,
      localPath,
      displayName: path.basename(localPath),
      boundBy,
      boundAt: Date.now(),
    };
    this.bindings.set(roomId, binding);
    await this.save();
    await this.startWatching(roomId, binding);
    this.onChange(roomId, binding, "bind");
    return binding;
  }

  async unbind(roomId: string, silent = false): Promise<void> {
    const w = this.watchers.get(roomId);
    if (w) {
      try {
        await w.close();
      } catch {
        /* best effort */
      }
      this.watchers.delete(roomId);
    }
    const previous = this.bindings.get(roomId) ?? null;
    this.bindings.delete(roomId);
    this.treeCache.delete(roomId);
    await this.save();
    if (!silent) this.onChange(roomId, previous, "unbind");
  }

  getBinding(roomId: string): Binding | null {
    return this.bindings.get(roomId) ?? null;
  }

  revealInFinder(roomId: string): void {
    const b = this.bindings.get(roomId);
    if (b) void shell.openPath(b.localPath);
  }

  // ===== Per-binding context (set from app settings) =====

  async setBindingContext(
    roomId: string,
    context: string,
  ): Promise<Binding | null> {
    const b = this.bindings.get(roomId);
    if (!b) return null;
    b.context = context.slice(0, this.MAX_CONTEXT_LEN);
    await this.save();
    this.onChange(roomId, b, "context-changed");
    return b;
  }

  // ===== Global context (~/.agentteams/agentteams.md) =====

  async getGlobalContext(): Promise<string> {
    try {
      return await fs.readFile(this.globalContextFile, "utf-8");
    } catch {
      return "";
    }
  }

  async setGlobalContext(text: string): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true }).catch(() => {
      /* best effort */
    });
    await fs.writeFile(this.globalContextFile, text);
  }

  /** Composite "system prompt" feed: global agentteams.md (if any) +
   *  per-binding context (if any). Both clamped to MAX_CONTEXT_LEN so
   *  one huge file can't blow up every message. */
  async getSystemContext(roomId: string): Promise<SystemContext> {
    const binding = this.bindings.get(roomId);
    let global: string | null = null;
    try {
      const txt = await fs.readFile(this.globalContextFile, "utf-8");
      global = txt.slice(0, this.MAX_CONTEXT_LEN);
    } catch {
      global = null;
    }
    const bindingCtx = binding?.context
      ? binding.context.slice(0, this.MAX_CONTEXT_LEN)
      : null;
    return { global, binding: bindingCtx };
  }

  // ===== Tree scan (lazy, cached, watcher-invalidated) =====

  async scanTree(roomId: string): Promise<TreeResult> {
    const binding = this.bindings.get(roomId);
    if (!binding) return { nodes: [], truncated: false };

    const cached = this.treeCache.get(roomId);
    if (cached && Date.now() - cached.ts < this.TREE_CACHE_TTL) {
      return { nodes: cached.nodes, truncated: cached.truncated };
    }

    const ignore = await this.buildIgnore();
    const nodes: FileNode[] = [];
    let truncated = false;

    const walk = async (dir: string): Promise<void> => {
      if (truncated) return;
      let entries: Dirent[];
      try {
        entries = (await fs.readdir(dir, { withFileTypes: true })) as Dirent[];
      } catch {
        return;
      }
      entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      for (const e of entries) {
        if (truncated) break;
        const full = path.join(dir, e.name);
        const rel = path
          .relative(binding.localPath, full)
          .replace(/\\/g, "/");
        if (!rel || ignore.matches(rel)) continue;
        try {
          const st = await fs.stat(full);
          nodes.push({
            path: rel,
            isDirectory: e.isDirectory(),
            size: st.size,
            mtime: st.mtimeMs,
          });
          if (nodes.length >= this.MAX_TREE_FILES) {
            truncated = true;
            break;
          }
          if (e.isDirectory()) await walk(full);
        } catch {
          /* unreadable — skip */
        }
      }
    };

    await walk(binding.localPath);
    this.treeCache.set(roomId, { nodes, truncated, ts: Date.now() });
    return { nodes, truncated };
  }

  // ===== Single-file read for reactive projection =====

  async readFile(roomId: string, relPath: string): Promise<ReadResult> {
    const binding = this.bindings.get(roomId);
    if (!binding) return { ok: false, error: "未绑定" };

    const safe = this.resolveSafe(binding.localPath, relPath);
    if (!safe) return { ok: false, error: "路径越界" };

    const ignore = await this.buildIgnore();
    if (ignore.matches(relPath)) {
      return { ok: false, error: "文件被忽略列表排除" };
    }

    try {
      const st = await fs.stat(safe);
      if (!st.isFile()) return { ok: false, error: "不是文件" };
      if (st.size > this.MAX_FILE_READ) {
        return { ok: false, error: `文件过大（${this.fmtSize(st.size)}）` };
      }
      const buf = await fs.readFile(safe);
      const isText = this.detectIsText(buf);
      return isText
        ? {
            ok: true,
            isText: true,
            content: buf.toString("utf-8"),
            size: st.size,
            mtime: st.mtimeMs,
          }
        : {
            ok: true,
            isText: false,
            base64: buf.toString("base64"),
            size: st.size,
            mtime: st.mtimeMs,
          };
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return { ok: false, error: "文件不存在" };
      return { ok: false, error: e.message ?? "读取失败" };
    }
  }

  // ===== Internals =====

  private async buildIgnore(): Promise<IgnoreEngine> {
    const ignore = new IgnoreEngine(this.DEFAULT_IGNORES);
    try {
      const txt = await fs.readFile(this.globalIgnoreFile, "utf-8");
      ignore.addPatterns(txt.split(/\r?\n/));
    } catch {
      /* no global ignore — defaults only */
    }
    return ignore;
  }

  /** Two-stage path safety: normalize away `..` and require the
   *  resolved absolute path to live at-or-below the binding root. */
  private resolveSafe(root: string, rel: string): string | null {
    const normalized = path.normalize(rel ?? "").replace(/^[\\/]+/, "");
    if (normalized.split(path.sep).includes("..")) return null;
    const resolved = path.resolve(root, normalized);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return null;
    }
    return resolved;
  }

  private detectIsText(buf: Buffer): boolean {
    const sample = buf.subarray(0, Math.min(buf.length, 8192));
    if (sample.includes(0)) return false;
    try {
      const decoded = sample.toString("utf-8");
      const replacementCount = (decoded.match(/�/g) || []).length;
      return replacementCount <= sample.length * 0.01;
    } catch {
      return false;
    }
  }

  private fmtSize(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  private async startWatching(
    roomId: string,
    binding: Binding,
  ): Promise<void> {
    const ignore = await this.buildIgnore();
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

    let timer: NodeJS.Timeout | null = null;
    const debounced = (): void => {
      this.treeCache.delete(roomId);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        this.onChange(roomId, binding, "tree-changed");
      }, this.RESCAN_DEBOUNCE_MS);
    };
    watcher.on("add", debounced);
    watcher.on("unlink", debounced);
    watcher.on("addDir", debounced);
    watcher.on("unlinkDir", debounced);
    // `change` events (file content modified in-place) also invalidate
    // the tree cache because mtimes shift — that's load-bearing for
    // the projection-dedup check on the renderer side.
    watcher.on("change", debounced);

    this.watchers.set(roomId, watcher);
  }
}
