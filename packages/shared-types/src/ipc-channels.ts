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
