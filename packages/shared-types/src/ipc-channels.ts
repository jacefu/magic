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

  // ---- Workspace folder binding (Spec 022 v3) ----
  /**
   * Per-channel sub-namespace so the binding lifecycle and file IO
   * stay grouped. Renderer consumes via `window.electronAPI.workspace.*`.
   *
   * v3 dropped the access-log / notify-tracker / list-dir surface from
   * v2 — Agents weren't going to implement the read_request protocol,
   * so the renderer ships file content as native Matrix attachments
   * instead. Surface is correspondingly smaller.
   */
  workspace: WorkspaceAPI;
}

export interface WorkspaceFileEntry {
  path: string;
  size: number;
  mtime: number;
}

export interface WorkspaceScanResult {
  fileCount: number;
  totalSize: number;
  ignoredCount: number;
  files: WorkspaceFileEntry[];
  truncated: boolean;
}

export interface WorkspaceBinding {
  roomId: string;
  localPath: string;
  displayName: string;
  boundBy: string;
  boundAt: number;
  fileCount: number;
  totalSize: number;
  ignorePatterns: string[];
  /** Spec §3.6 — when off, useMessageInterceptor only attaches files
   *  the user explicitly picked via 📁 button; auto-detection from
   *  message text is skipped. */
  autoAttach: boolean;
}

export interface WorkspaceReadResult {
  ok: boolean;
  /** base64-encoded raw file bytes — IPC can't ship a Buffer directly. */
  contentBase64?: string;
  encoding?: "utf-8" | "base64";
  size?: number;
  mtime?: number;
  isText?: boolean;
  error?: string;
}

export interface WorkspaceBindResult {
  binding: WorkspaceBinding;
  files: WorkspaceFileEntry[];
}

export interface WorkspaceAPI {
  pickFolder: () => Promise<string | null>;
  scanFolder: (folderPath: string) => Promise<WorkspaceScanResult>;
  bind: (
    roomId: string,
    folderPath: string,
    boundBy: string,
  ) => Promise<WorkspaceBindResult>;
  unbind: (roomId: string) => Promise<void>;
  getBinding: (roomId: string) => Promise<WorkspaceBinding | null>;
  getFileTree: (roomId: string) => Promise<WorkspaceFileEntry[]>;
  revealInFinder: (roomId: string) => Promise<void>;
  /** Spec §5.2.1 — useMessageInterceptor's read path. */
  readFile: (
    roomId: string,
    relPath: string,
  ) => Promise<WorkspaceReadResult>;
  /** Spec §3.6 — auto-attach toggle. */
  setAutoAttach: (roomId: string, enabled: boolean) => Promise<void>;
  getAutoAttach: (roomId: string) => Promise<boolean>;
  /** main → renderer push: bind / unbind / watcher republish. The
   *  payload carries the canonical binding + current file tree so
   *  the renderer can rehydrate without a follow-up IPC roundtrip. */
  onTreeChanged: (
    cb: (payload: {
      roomId: string;
      binding: WorkspaceBinding | null;
      files: WorkspaceFileEntry[];
    }) => void,
  ) => () => void;
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
