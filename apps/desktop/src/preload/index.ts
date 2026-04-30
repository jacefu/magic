import { contextBridge, ipcRenderer } from "electron";
import type { IElectronAPI, AppSettings } from "@magic/shared-types";

const electronAPI: IElectronAPI = {
  // ---- Matrix (placeholders, 004-auth-flow will implement) ----
  matrixLogin: (homeserver, username, password) =>
    ipcRenderer.invoke("matrix:login", homeserver, username, password),
  matrixLogout: () => ipcRenderer.invoke("matrix:logout"),
  matrixRestoreSession: () => ipcRenderer.invoke("matrix:restore-session"),
  matrixSendMessage: (roomId, body, html) =>
    ipcRenderer.invoke("matrix:send-message", roomId, body, html),
  matrixSendFile: (roomId, filePath) =>
    ipcRenderer.invoke("matrix:send-file", roomId, filePath),

  // ---- Event streams ----
  onMatrixEvent: (cb) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => cb(data);
    ipcRenderer.on("matrix:event", handler);
    return () => ipcRenderer.off("matrix:event", handler);
  },
  onSyncStateChange: (cb) => {
    const handler = (_event: Electron.IpcRendererEvent, state: string) => cb(state);
    ipcRenderer.on("matrix:sync-state", handler);
    return () => ipcRenderer.off("matrix:sync-state", handler);
  },

  // ---- Settings ----
  getSettings: () => ipcRenderer.invoke("settings:get") as Promise<AppSettings>,
  setSetting: (key, value) => ipcRenderer.invoke("settings:set", key, value),

  // ---- Window ----
  windowMinimize: () => ipcRenderer.send("window:minimize"),
  windowMaximize: () => ipcRenderer.send("window:maximize"),
  windowClose: () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  isFullscreen: () => ipcRenderer.invoke("window:is-fullscreen"),
  onWindowStateChanged: (cb) => {
    const handler = (_event: Electron.IpcRendererEvent, state: any) => cb(state);
    ipcRenderer.on("window:state-changed", handler);
    return () => ipcRenderer.off("window:state-changed", handler);
  },

  // ---- Notifications ----
  showNotification: (payload) => ipcRenderer.invoke("notify:show", payload),
  onNotifyClicked: (cb) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => cb(data);
    ipcRenderer.on("notify:clicked", handler);
    return () => ipcRenderer.off("notify:clicked", handler);
  },

  // ---- Shell ----
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  openFileDialog: (options) => ipcRenderer.invoke("shell:open-file-dialog", options),
  saveFileDialog: (options) => ipcRenderer.invoke("shell:save-file-dialog", options),

  // ---- App info ----
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  getPlatform: () => ipcRenderer.invoke("app:get-platform"),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
