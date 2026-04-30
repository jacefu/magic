import type { IElectronAPI } from "@magic/shared-types";

export function useElectronAPI(): IElectronAPI | null {
  if (typeof window !== "undefined" && "electronAPI" in window) {
    return window.electronAPI;
  }
  return null;
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && "electronAPI" in window;
}
