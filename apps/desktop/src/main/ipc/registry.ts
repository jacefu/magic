import { ipcMain, type BrowserWindow } from "electron";

type HandlerFn = (...args: any[]) => Promise<any> | any;

export interface IPCModule {
  handlers?: Record<string, HandlerFn>;
  listeners?: Record<string, HandlerFn>;
}

export function registerIPCHandlers(
  mainWindow: BrowserWindow,
  modules: IPCModule[],
): void {
  for (const mod of modules) {
    if (mod.handlers) {
      for (const [channel, handler] of Object.entries(mod.handlers)) {
        ipcMain.handle(channel, async (_event, ...args) => {
          try {
            return await handler(...args, mainWindow);
          } catch (error) {
            console.error(`[IPC Error] ${channel}:`, error);
            throw error;
          }
        });
      }
    }

    if (mod.listeners) {
      for (const [channel, listener] of Object.entries(mod.listeners)) {
        ipcMain.on(channel, (_event, ...args) => {
          try {
            listener(...args, mainWindow);
          } catch (error) {
            console.error(`[IPC Error] ${channel}:`, error);
          }
        });
      }
    }
  }
}

export function unregisterAllHandlers(modules: IPCModule[]): void {
  for (const mod of modules) {
    if (mod.handlers) {
      for (const channel of Object.keys(mod.handlers)) {
        ipcMain.removeHandler(channel);
      }
    }
    if (mod.listeners) {
      for (const channel of Object.keys(mod.listeners)) {
        ipcMain.removeAllListeners(channel);
      }
    }
  }
}
