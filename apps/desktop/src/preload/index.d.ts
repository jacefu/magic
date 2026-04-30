import type { IElectronAPI } from "@magic/shared-types";

declare global {
  interface Window {
    electronAPI: Pick<
      IElectronAPI,
      "getSettings" | "setSetting" | "windowMinimize" | "windowMaximize" | "windowClose"
    >;
  }
}
