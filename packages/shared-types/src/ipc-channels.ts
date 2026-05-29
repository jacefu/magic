export interface IElectronAPI {
  // ---- Matrix (placeholders, 004-auth-flow will implement) ----
  matrixLogin: (homeserver: string, username: string, password: string) => Promise<LoginResponse>;
  matrixLogout: () => Promise<void>;
  matrixRestoreSession: () => Promise<boolean>;
  matrixSendMessage: (roomId: string, body: string, html?: string) => Promise<void>;
  matrixSendFile: (roomId: string, filePath: string) => Promise<void>;

  // ---- Event streams ----
  onMatrixEvent: (cb: (event: SerializedMatrixEvent) => void) => () => void;
  onSyncStateChange: (cb: (state: string) => void) => () => void;

  // ---- Settings ----
  getSettings: () => Promise<AppSettings>;
  setSetting: (key: string, value: unknown) => Promise<void>;

  // ---- Sessions (Spec 017: encrypted at rest via electron-store) ----
  saveSessions: (sessions: PersistedSession[]) => Promise<void>;
  loadSessions: () => Promise<PersistedSession[]>;

  // ---- Window ----
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  isMaximized: () => Promise<boolean>;
  isFullscreen: () => Promise<boolean>;
  onWindowStateChanged: (cb: (state: "maximized" | "normal" | "fullscreen") => void) => () => void;

  // ---- Notifications ----
  showNotification: (payload: NotifyPayload) => Promise<void>;
  onNotifyClicked: (cb: (data: { roomId?: string; eventId?: string }) => void) => () => void;
  /**
   * Update the macOS Dock badge / tray title with the unread total.
   * Pass 0 to clear.
   */
  setBadgeCount: (count: number) => Promise<void>;

  // ---- Shell ----
  openExternal: (url: string) => Promise<void>;
  openFileDialog: (options?: FileDialogOptions) => Promise<string[] | null>;
  saveFileDialog: (options?: SaveDialogOptions) => Promise<string | null>;

  // ---- App info ----
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;

  // ---- Workspace context injection (Spec 022 v6) ----
  /**
   * Per-channel sub-namespace so the binding lifecycle, tree scan,
   * system-prompt editor, and reactive file reader stay grouped.
   * Renderer consumes via `window.electronAPI.workspace.*`.
   *
   * v6 deletes the file-picker / autoAttach / fileCount / ignorePatterns
   * surface from v3 — the workspace context is injected straight into
   * every user message body so the Agent reads it as part of the
   * prompt, no explicit attachments required. Surface is correspondingly
   * smaller and centred on tree+context fetches plus a single-file
   * reactive reader for path-mention projection.
   */
  workspace: WorkspaceAPI;
}

export interface WorkspaceFileNode {
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: number;
}

export interface WorkspaceTreeResult {
  nodes: WorkspaceFileNode[];
  truncated: boolean;
}

export interface WorkspaceBinding {
  roomId: string;
  localPath: string;
  displayName: string;
  boundBy: string;
  boundAt: number;
  /** Per-binding system prompt edited via the App settings panel.
   *  Stored under the binding in `~/.agentteams/workspaces.json`. */
  context?: string;
}

export interface WorkspaceSystemContext {
  /** Body of `~/.agentteams/agentteams.md`, capped at 8 KB. */
  global: string | null;
  /** Per-binding context, capped at 8 KB. */
  binding: string | null;
}

export interface WorkspaceReadResult {
  ok: boolean;
  isText?: boolean;
  /** UTF-8 text body when isText. */
  content?: string;
  /** base64 bytes when binary. IPC can't ship a Buffer directly. */
  base64?: string;
  size?: number;
  mtime?: number;
  error?: string;
}

export type WorkspaceChangeKind =
  | "bind"
  | "tree-changed"
  | "unbind"
  | "context-changed";

export interface WorkspaceChangePayload {
  roomId: string;
  binding: WorkspaceBinding | null;
  kind: WorkspaceChangeKind;
}

export interface WorkspaceAPI {
  pickFolder: () => Promise<string | null>;
  bind: (
    roomId: string,
    folderPath: string,
    boundBy: string,
  ) => Promise<WorkspaceBinding>;
  unbind: (roomId: string) => Promise<void>;
  getBinding: (roomId: string) => Promise<WorkspaceBinding | null>;
  scanTree: (roomId: string) => Promise<WorkspaceTreeResult>;
  getSystemContext: (roomId: string) => Promise<WorkspaceSystemContext>;
  setBindingContext: (
    roomId: string,
    context: string,
  ) => Promise<WorkspaceBinding | null>;
  getGlobalContext: () => Promise<string>;
  setGlobalContext: (text: string) => Promise<void>;
  readFile: (
    roomId: string,
    relPath: string,
  ) => Promise<WorkspaceReadResult>;
  revealInFinder: (roomId: string) => Promise<void>;
  /** main → renderer push: bind / unbind / watcher republish /
   *  context-changed. Renderer rehydrates from the canonical binding
   *  in the payload. */
  onChange: (cb: (payload: WorkspaceChangePayload) => void) => () => void;
}

export interface LoginResponse {
  userId: string;
  deviceId: string;
  accessToken: string;
  homeserver: string;
}

export interface SerializedMatrixEvent {
  eventId: string;
  roomId: string;
  type: string;
  sender: string;
  content: Record<string, unknown>;
  timestamp: number;
  unsigned?: Record<string, unknown>;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  language: "zh" | "en";
  notifications: boolean;
  startMinimized: boolean;
  homeserver: string;
}

/**
 * On-disk shape of a saved Matrix session. Spec 017 — Electron stores
 * these in `magic-sessions.json` (encrypted via electron-store's
 * `encryptionKey`). Web stores them in localStorage, AES-GCM-encrypted
 * with a non-extractable key kept in IndexedDB.
 */
export interface PersistedSession {
  id: string;
  homeserver: string;
  userId: string;
  deviceId: string;
  accessToken: string;
  serverName: string;
  serverInitial: string;
  serverColor: string | null;
  /**
   * Optional user-uploaded server icon, encoded as a `data:image/...;base64,…`
   * URL. Resized to ≤128 px² before storage so a megabyte hi-res photo
   * doesn't bloat the persisted sessions file. When present the
   * workspace rail renders this image instead of the letter+colour
   * fallback.
   */
  iconDataUrl?: string | null;
  /**
   * `cryptoDatabasePrefix` passed to `client.initRustCrypto`. Set per
   * session so concurrent clients don't fight for a single shared
   * `matrix-js-sdk::*` IndexedDB store — that contention caused the
   * second AddServerDialog to hang at "连接中…". Sessions persisted
   * before this field existed leave it unset and continue using the
   * legacy default DB so their crypto state isn't orphaned.
   */
  cryptoPrefix?: string;
  addedAt: number;
}

export interface NotifyPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  roomId?: string;
  eventId?: string;
}

export interface FileDialogOptions {
  filters?: { name: string; extensions: string[] }[];
  title?: string;
  defaultPath?: string;
  multiSelections?: boolean;
}

export interface SaveDialogOptions {
  filters?: { name: string; extensions: string[] }[];
  title?: string;
  defaultPath?: string;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
