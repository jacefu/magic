import type { IElectronAPI } from "@magic/shared-types";

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
