import { shell, dialog, type BrowserWindow } from "electron";
import type { IPCModule } from "./registry.js";

export function createShellHandlers(): IPCModule {
  return {
    handlers: {
      "shell:open-external": async (url: string) => {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          throw new Error(`不允许打开非 HTTP 协议链接: ${url}`);
        }
        await shell.openExternal(url);
      },

      "shell:open-file-dialog": async (...args: any[]) => {
        const options = args[0] as Electron.OpenDialogOptions | undefined;
        const win = args[args.length - 1] as BrowserWindow;
        const result = await dialog.showOpenDialog(win, {
          properties: ["openFile"],
          filters: options?.filters ?? [{ name: "所有文件", extensions: ["*"] }],
          ...options,
        });
        return result.canceled ? null : result.filePaths;
      },

      "shell:save-file-dialog": async (...args: any[]) => {
        const options = args[0] as Electron.SaveDialogOptions | undefined;
        const win = args[args.length - 1] as BrowserWindow;
        const result = await dialog.showSaveDialog(win, { ...options });
        return result.canceled ? null : result.filePath;
      },
    },
  };
}
