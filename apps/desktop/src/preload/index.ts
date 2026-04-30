import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSetting: (key: string, value: unknown) =>
    ipcRenderer.invoke("settings:set", key, value),
  windowMinimize: () => ipcRenderer.send("window:minimize"),
  windowMaximize: () => ipcRenderer.send("window:maximize"),
  windowClose: () => ipcRenderer.send("window:close"),
});
