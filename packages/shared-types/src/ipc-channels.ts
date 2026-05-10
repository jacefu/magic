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

  // ---- Workspace folder binding (Spec 022) ----
  /**
   * Per-channel sub-namespace so the binding lifecycle, file IO, and
   * push notifications stay grouped. Renderer code consumes via
   * `window.electronAPI.workspace.*`.
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
}

export interface WorkspaceAccessLogEntry {
  timestamp: number;
  type: "read" | "list";
  path: string;
  agentUserId: string;
  bytes: number;
  success: boolean;
}

export interface WorkspaceReadResult {
  ok: boolean;
  /** base64-encoded raw file bytes — IPC can't ship a Buffer directly. */
  contentBase64?: string;
  encoding?: "utf-8" | "base64";
  size?: number;
  mtime?: number;
  error?: string;
  errorMessage?: string;
}

export interface WorkspaceListResult {
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

export interface WorkspaceAPI {
  pickFolder: () => Promise<string | null>;
  scanFolder: (folderPath: string) => Promise<WorkspaceScanResult>;
  bind: (
    roomId: string,
    folderPath: string,
    boundBy: string,
  ) => Promise<WorkspaceBinding>;
  unbind: (roomId: string) => Promise<void>;
  getBinding: (roomId: string) => Promise<WorkspaceBinding | null>;
  getAllBindings: () => Promise<WorkspaceBinding[]>;
  revealInFinder: (roomId: string) => Promise<void>;
  readFile: (
    roomId: string,
    relPath: string,
    maxSize: number,
    requesterId: string,
  ) => Promise<WorkspaceReadResult>;
  listDir: (
    roomId: string,
    relPath: string,
    depth: number,
    requesterId: string,
  ) => Promise<WorkspaceListResult>;
  getAccessLog: (
    roomId: string,
    limit: number,
  ) => Promise<WorkspaceAccessLogEntry[]>;
  /** main → renderer push: file watcher republish. */
  onFileTreeChanged: (
    cb: (payload: { roomId: string; files: WorkspaceFileEntry[] }) => void,
  ) => () => void;
  /** main → renderer push: bind / unbind / metadata change. */
  onBindingChanged: (
    cb: (payload: {
      roomId: string;
      binding: WorkspaceBinding | null;
    }) => void,
  ) => () => void;
  /** main → renderer push: a read or list just completed. */
  onAccessLogged: (
    cb: (payload: { roomId: string; entry: WorkspaceAccessLogEntry }) => void,
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
