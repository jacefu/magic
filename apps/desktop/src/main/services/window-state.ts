import { settingsStore } from "../store.js";
import type { BrowserWindow } from "electron";

const BOUNDS_KEY = "windowBounds" as any;

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

export function restoreWindowBounds(): Partial<Electron.BrowserWindowConstructorOptions> {
  const saved = settingsStore.get(BOUNDS_KEY) as WindowBounds | undefined;
  if (!saved) {
    return { width: 1280, height: 800 };
  }
  return {
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
  };
}

export function trackWindowState(win: BrowserWindow): void {
  const save = () => {
    if (win.isDestroyed()) return;
    const bounds = win.getBounds();
    settingsStore.set(BOUNDS_KEY as any, {
      ...bounds,
      isMaximized: win.isMaximized(),
    } as any);
  };

  win.on("resized", save);
  win.on("moved", save);

  const saved = settingsStore.get(BOUNDS_KEY) as WindowBounds | undefined;
  if (saved?.isMaximized) {
    win.maximize();
  }
}
