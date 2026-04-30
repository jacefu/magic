import type { BrowserWindow } from "electron";
import type { IPCModule } from "./registry.js";

export function createWindowHandlers(): IPCModule {
  return {
    handlers: {
      "window:is-maximized": (...args: any[]) => {
        const win = args[args.length - 1] as BrowserWindow;
        return win.isMaximized();
      },
      "window:is-fullscreen": (...args: any[]) => {
        const win = args[args.length - 1] as BrowserWindow;
        return win.isFullScreen();
      },
    },
    listeners: {
      "window:minimize": (...args: any[]) => {
        const win = args[args.length - 1] as BrowserWindow;
        win.minimize();
      },
      "window:maximize": (...args: any[]) => {
        const win = args[args.length - 1] as BrowserWindow;
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
      },
      "window:close": (...args: any[]) => {
        const win = args[args.length - 1] as BrowserWindow;
        win.hide();
      },
    },
  };
}
