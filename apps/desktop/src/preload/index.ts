import { contextBridge, ipcRenderer } from "electron";
import type {
  IElectronAPI,
  AppSettings,
  PersistedSession,
} from "@magic/shared-types";

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

  // ---- Sessions ----
  saveSessions: (sessions) =>
    ipcRenderer.invoke("sessions:save", sessions) as Promise<void>,
  loadSessions: () =>
    ipcRenderer.invoke("sessions:load") as Promise<PersistedSession[]>,

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
  setBadgeCount: (count) => ipcRenderer.invoke("notify:set-badge", count),

  // ---- Shell ----
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  openFileDialog: (options) => ipcRenderer.invoke("shell:open-file-dialog", options),
  saveFileDialog: (options) => ipcRenderer.invoke("shell:save-file-dialog", options),

  // ---- App info ----
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  getPlatform: () => ipcRenderer.invoke("app:get-platform"),

  // ---- Workspace (Spec 022 v3) ----
  workspace: {
    pickFolder: () => ipcRenderer.invoke("workspace:pickFolder"),
    scanFolder: (folderPath) =>
      ipcRenderer.invoke("workspace:scanFolder", folderPath),
    bind: (roomId, folderPath, boundBy) =>
      ipcRenderer.invoke("workspace:bind", roomId, folderPath, boundBy),
    unbind: (roomId) => ipcRenderer.invoke("workspace:unbind", roomId),
    getBinding: (roomId) =>
      ipcRenderer.invoke("workspace:getBinding", roomId),
    getFileTree: (roomId) =>
      ipcRenderer.invoke("workspace:getFileTree", roomId),
    revealInFinder: (roomId) =>
      ipcRenderer.invoke("workspace:revealInFinder", roomId),
    readFile: (roomId, relPath) =>
      ipcRenderer.invoke("workspace:readFile", roomId, relPath),
    setAutoAttach: (roomId, enabled) =>
      ipcRenderer.invoke("workspace:setAutoAttach", roomId, enabled),
    getAutoAttach: (roomId) =>
      ipcRenderer.invoke("workspace:getAutoAttach", roomId),
    onTreeChanged: (cb) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) =>
        cb(data);
      ipcRenderer.on("workspace:tree-changed", handler);
      return () => ipcRenderer.off("workspace:tree-changed", handler);
    },
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
