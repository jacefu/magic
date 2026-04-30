export interface IElectronAPI {
  matrixLogin: (homeserver: string, username: string, password: string) => Promise<LoginResponse>;
  matrixLogout: () => Promise<void>;
  matrixRestoreSession: () => Promise<boolean>;

  matrixSendMessage: (roomId: string, body: string, html?: string) => Promise<void>;
  matrixSendFile: (roomId: string, filePath: string) => Promise<void>;

  onMatrixEvent: (cb: (event: SerializedMatrixEvent) => void) => () => void;
  onSyncStateChange: (cb: (state: string) => void) => () => void;

  getSettings: () => Promise<AppSettings>;
  setSetting: (key: string, value: unknown) => Promise<void>;

  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
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

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
