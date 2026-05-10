import { app, BrowserWindow, shell } from "electron";
import { join } from "path";

import { registerIPCHandlers } from "./ipc/registry.js";
import { createWindowHandlers } from "./ipc/window.js";
import { createSettingsHandlers } from "./ipc/settings.js";
import { createSessionsHandlers } from "./ipc/sessions.js";
import { createShellHandlers } from "./ipc/shell.js";
import { createAppHandlers } from "./ipc/app.js";
import { createNotifyHandlers } from "./ipc/notify.js";
import { createWorkspaceHandlers } from "./ipc/workspace.js";

import { createTray, destroyTray } from "./services/tray.js";
import { restoreWindowBounds, trackWindowState } from "./services/window-state.js";
import { WorkspaceManager } from "./workspace/WorkspaceManager.js";

import { settingsStore } from "./store.js";

let mainWindow: BrowserWindow | null = null;

// Spec 022 v3 §5.1.2 — broadcast bind/unbind/file-tree refresh to
// every renderer via the workspace:tree-changed channel. The
// renderer's useWorkspaceBinding picks this up to refresh its local
// view; the actual Matrix-side announcement is fired from the bind
// dialog (see §5.2.3), not from here.
const workspace = new WorkspaceManager((roomId, binding, files) => {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("workspace:tree-changed", {
        roomId,
        binding,
        files,
      });
    }
  }
});

function createWindow(): BrowserWindow {
  const bounds = restoreWindowBounds();

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: "#111827",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: true,
    },
  });

  trackWindowState(win);

  win.on("ready-to-show", () => {
    if (settingsStore.get("startMinimized")) {
      // stay hidden in tray
    } else {
      win.show();
      win.focus();
    }
  });

  win.on("maximize", () => win.webContents.send("window:state-changed", "maximized"));
  win.on("unmaximize", () => win.webContents.send("window:state-changed", "normal"));
  win.on("enter-full-screen", () => win.webContents.send("window:state-changed", "fullscreen"));
  win.on("leave-full-screen", () => win.webContents.send("window:state-changed", "normal"));

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const rendererUrl = process.env["ELECTRON_RENDERER_URL"];
    if (rendererUrl && !url.startsWith(rendererUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (!app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}

app.whenReady().then(async () => {
  mainWindow = createWindow();

  registerIPCHandlers(mainWindow, [
    createWindowHandlers(),
    createSettingsHandlers(),
    createSessionsHandlers(),
    createShellHandlers(),
    createAppHandlers(),
    createNotifyHandlers(),
    createWorkspaceHandlers(workspace),
  ]);

  // Restore persisted bindings + re-attach watchers. Awaited so the
  // first renderer frame can already read accurate binding state via
  // workspace:getBinding instead of racing the file IO.
  await workspace.load();

  createTray(mainWindow);

  app.on("activate", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // keep running in tray
});

app.on("before-quit", () => {
  destroyTray();
  // Fire-and-forget — we don't block quit on watcher cleanup. chokidar
  // closes its FS handles synchronously enough that orphaned watchers
  // are cleaned up by the OS anyway.
  void workspace.shutdown();
});

app.on("web-contents-created", (_, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
});
