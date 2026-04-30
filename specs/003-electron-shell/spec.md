# Spec 003: Electron Shell（主进程与 IPC 架构）

> 优先级: P0 | 波次: Wave 1 | 预估: 2-3 天 | 前置依赖: 001-monorepo-scaffold, 002-matrix-sdk-wrapper

---

## 1. 目标

构建 Electron 主进程的完整架构——IPC handler 注册机制、preload 安全桥接、窗口管理、系统托盘、原生通知服务、本地设置持久化、以及开发/生产环境切换。完成后，renderer 进程（React 应用）可以通过类型安全的 `window.electronAPI` 与主进程通信，主进程可以主动向 renderer 推送原生事件。

### 用户故事

- 作为 UI 开发者，我希望通过 `window.electronAPI.getSettings()` 读取本地设置，无需了解 Electron IPC 细节
- 作为 UI 开发者，我希望通过 `window.electronAPI.showNotification()` 触发系统原生通知
- 作为用户，我希望关闭窗口后应用最小化到系统托盘而非退出
- 作为用户，我希望点击托盘图标可以恢复窗口
- 作为用户，我希望 macOS 上有无框窗口 + 红绿灯按钮的原生体验
- 作为开发者，我希望 IPC 通道有统一的注册、错误处理和日志机制

### 非目标（本 spec 不实现）

- Matrix 相关的 IPC handler（如 `matrix:login`）—— 推迟到 004-auth-flow
- 自动更新 —— 推迟到 013-auto-update
- Deep linking —— 推迟到后续 spec

---

## 2. 架构设计

### 2.1 进程职责划分

```
┌─────────────────────────────────────────────────────┐
│ Main 进程（Node.js）                                  │
│                                                      │
│  ├── ipc/            IPC handler 注册与路由            │
│  │   ├── registry.ts   统一注册机制                    │
│  │   ├── window.ts     窗口控制（最小化/最大化/关闭）    │
│  │   ├── settings.ts   本地设置读写                    │
│  │   └── shell.ts      外部链接/文件对话框              │
│  │                                                    │
│  ├── services/       原生服务                          │
│  │   ├── tray.ts       系统托盘 + 上下文菜单            │
│  │   ├── notifications.ts  原生通知                    │
│  │   └── window-state.ts   窗口位置/尺寸记忆            │
│  │                                                    │
│  ├── store.ts        electron-store 实例               │
│  └── index.ts        应用入口 + 生命周期                │
│                                                      │
├─────────────────────────────────────────────────────┤
│ Preload 脚本（隔离桥接）                               │
│  └── index.ts        contextBridge.exposeInMainWorld  │
│                                                      │
├─────────────────────────────────────────────────────┤
│ Renderer 进程（Chromium 沙箱）                         │
│  └── 通过 window.electronAPI 调用主进程                │
│  └── MatrixClient + Zustand stores 全部在这里运行      │
└─────────────────────────────────────────────────────┘
```

### 2.2 IPC 通道命名规范

所有通道使用 `domain:action` 格式：

| 域 | 通道 | 方向 | 说明 |
|----|------|------|------|
| `window` | `window:minimize` | renderer→main | 最小化窗口 |
| `window` | `window:maximize` | renderer→main | 最大化/还原窗口 |
| `window` | `window:close` | renderer→main | 关闭窗口（最小化到托盘） |
| `window` | `window:is-maximized` | renderer→main | 查询是否最大化 |
| `window` | `window:is-fullscreen` | renderer→main | 查询是否全屏 |
| `window` | `window:state-changed` | main→renderer | 窗口状态变化通知 |
| `settings` | `settings:get` | renderer→main | 读取全部设置 |
| `settings` | `settings:set` | renderer→main | 写入单个设置 |
| `settings` | `settings:get-value` | renderer→main | 读取单个设置值 |
| `shell` | `shell:open-external` | renderer→main | 在系统浏览器打开链接 |
| `shell` | `shell:open-file-dialog` | renderer→main | 打开文件选择对话框 |
| `shell` | `shell:save-file-dialog` | renderer→main | 打开保存文件对话框 |
| `notify` | `notify:show` | renderer→main | 显示原生通知 |
| `notify` | `notify:clicked` | main→renderer | 用户点击了通知 |
| `app` | `app:get-version` | renderer→main | 获取应用版本号 |
| `app` | `app:get-platform` | renderer→main | 获取当前平台（darwin/win32） |

---

## 3. 技术规格

### 3.1 依赖安装

在 `apps/desktop/` 中：
```bash
pnpm add electron-store@^10.0.0
pnpm add -D @electron-toolkit/utils@^3.0.0
```

> `electron-store` v10 是 ESM-only，要求 Electron 30+，与我们的 Electron 38 兼容。

### 3.2 src/main/store.ts — 本地设置

```typescript
// apps/desktop/src/main/store.ts
import Store from "electron-store";
import type { AppSettings } from "@magic/shared-types";

const defaults: AppSettings = {
  theme: "system",
  language: "zh",
  notifications: true,
  startMinimized: false,
  homeserver: "https://matrix.magic.com",
};

export const settingsStore = new Store<AppSettings>({
  name: "magic-settings",
  defaults,
  // electron-store 在 main 进程中自动使用 app.getPath("userData")
});
```

### 3.3 src/main/ipc/registry.ts — IPC 统一注册

```typescript
// apps/desktop/src/main/ipc/registry.ts
import { ipcMain, type BrowserWindow } from "electron";

type HandlerFn = (...args: any[]) => Promise<any> | any;

interface IPCModule {
  handlers?: Record<string, HandlerFn>;        // invoke/handle 模式（有返回值）
  listeners?: Record<string, HandlerFn>;       // send/on 模式（无返回值）
}

/**
 * 统一注册所有 IPC handler。
 * 自动包裹 try-catch 并返回统一错误格式。
 */
export function registerIPCHandlers(
  mainWindow: BrowserWindow,
  modules: IPCModule[],
): void {
  for (const mod of modules) {
    // invoke/handle（有返回值）
    if (mod.handlers) {
      for (const [channel, handler] of Object.entries(mod.handlers)) {
        ipcMain.handle(channel, async (_event, ...args) => {
          try {
            return await handler(...args, mainWindow);
          } catch (error) {
            console.error(`[IPC Error] ${channel}:`, error);
            throw error; // Electron 会将错误序列化传回 renderer
          }
        });
      }
    }

    // send/on（无返回值，fire-and-forget）
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

/**
 * 注销所有 IPC handler（用于热重载或关闭时清理）。
 */
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
```

### 3.4 src/main/ipc/window.ts — 窗口控制

```typescript
// apps/desktop/src/main/ipc/window.ts
import type { BrowserWindow } from "electron";
import type { IPCModule } from "./registry";

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
        // 不退出应用，最小化到托盘
        win.hide();
      },
    },
  };
}
```

### 3.5 src/main/ipc/settings.ts — 设置读写

```typescript
// apps/desktop/src/main/ipc/settings.ts
import { settingsStore } from "../store";
import type { AppSettings } from "@magic/shared-types";
import type { IPCModule } from "./registry";

export function createSettingsHandlers(): IPCModule {
  return {
    handlers: {
      "settings:get": (): AppSettings => {
        return settingsStore.store; // 返回全部设置
      },
      "settings:set": (key: string, value: unknown) => {
        settingsStore.set(key as keyof AppSettings, value as any);
      },
      "settings:get-value": (key: string) => {
        return settingsStore.get(key as keyof AppSettings);
      },
    },
  };
}
```

### 3.6 src/main/ipc/shell.ts — 系统交互

```typescript
// apps/desktop/src/main/ipc/shell.ts
import { shell, dialog, type BrowserWindow } from "electron";
import type { IPCModule } from "./registry";

export function createShellHandlers(): IPCModule {
  return {
    handlers: {
      "shell:open-external": async (url: string) => {
        // 安全校验：仅允许 http/https 协议
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
          filters: options?.filters ?? [
            { name: "所有文件", extensions: ["*"] },
          ],
          ...options,
        });
        return result.canceled ? null : result.filePaths;
      },

      "shell:save-file-dialog": async (...args: any[]) => {
        const options = args[0] as Electron.SaveDialogOptions | undefined;
        const win = args[args.length - 1] as BrowserWindow;
        const result = await dialog.showSaveDialog(win, {
          ...options,
        });
        return result.canceled ? null : result.filePath;
      },
    },
  };
}
```

### 3.7 src/main/ipc/app.ts — 应用信息

```typescript
// apps/desktop/src/main/ipc/app.ts
import { app } from "electron";
import type { IPCModule } from "./registry";

export function createAppHandlers(): IPCModule {
  return {
    handlers: {
      "app:get-version": () => app.getVersion(),
      "app:get-platform": () => process.platform,
    },
  };
}
```

### 3.8 src/main/ipc/notify.ts — 通知转发

```typescript
// apps/desktop/src/main/ipc/notify.ts
import { Notification, type BrowserWindow } from "electron";
import type { IPCModule } from "./registry";

export interface NotifyPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;       // 用于去重/替换
  roomId?: string;     // 点击后跳转的房间
  eventId?: string;    // 点击后高亮的消息
}

export function createNotifyHandlers(): IPCModule {
  return {
    handlers: {
      "notify:show": (payload: NotifyPayload, ...rest: any[]) => {
        const win = rest[rest.length - 1] as BrowserWindow;

        if (!Notification.isSupported()) return;

        const notification = new Notification({
          title: payload.title,
          body: payload.body,
          icon: payload.icon,
          silent: false,
        });

        notification.on("click", () => {
          // 恢复窗口并通知 renderer
          win.show();
          win.focus();
          win.webContents.send("notify:clicked", {
            roomId: payload.roomId,
            eventId: payload.eventId,
          });
        });

        notification.show();
      },
    },
  };
}
```

### 3.9 src/main/services/tray.ts — 系统托盘

```typescript
// apps/desktop/src/main/services/tray.ts
import { Tray, Menu, nativeImage, type BrowserWindow, app } from "electron";
import { join } from "path";

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow): Tray {
  // 托盘图标：开发环境用项目目录，生产环境用打包资源
  const iconPath = join(
    app.isPackaged ? process.resourcesPath : join(__dirname, "../../build"),
    process.platform === "darwin" ? "tray-icon-mac.png" : "tray-icon.png",
  );

  // 如果图标文件不存在，使用空白 16x16 图标（开发阶段）
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    icon = nativeImage.createEmpty();
  }

  if (process.platform === "darwin") {
    icon = icon.resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  tray.setToolTip("MAGIC Client");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示 MAGIC Client",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        app.exit(0); // 强制退出（跳过 window-all-closed）
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 单击托盘图标显示/隐藏窗口（Windows 行为）
  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

/**
 * 更新托盘图标上的未读角标（macOS dock + 托盘 title）。
 */
export function updateTrayBadge(count: number): void {
  if (process.platform === "darwin") {
    app.dock?.setBadge(count > 0 ? String(count) : "");
  }
  if (tray) {
    tray.setTitle(count > 0 ? ` ${count}` : "");
  }
}
```

### 3.10 src/main/services/window-state.ts — 窗口状态记忆

```typescript
// apps/desktop/src/main/services/window-state.ts
import { settingsStore } from "../store";
import type { BrowserWindow, Rectangle } from "electron";

const BOUNDS_KEY = "windowBounds" as any;

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

/**
 * 恢复上次的窗口位置和尺寸。
 */
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

/**
 * 监听窗口移动/调整大小事件，自动保存。
 */
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

  // 启动时如果上次是最大化的，恢复最大化
  const saved = settingsStore.get(BOUNDS_KEY) as WindowBounds | undefined;
  if (saved?.isMaximized) {
    win.maximize();
  }
}
```

### 3.11 src/main/index.ts — 应用入口（完整版）

```typescript
// apps/desktop/src/main/index.ts
import { app, BrowserWindow, shell } from "electron";
import { join } from "path";
import { is } from "@electron-toolkit/utils";

// IPC
import { registerIPCHandlers } from "./ipc/registry";
import { createWindowHandlers } from "./ipc/window";
import { createSettingsHandlers } from "./ipc/settings";
import { createShellHandlers } from "./ipc/shell";
import { createAppHandlers } from "./ipc/app";
import { createNotifyHandlers } from "./ipc/notify";

// Services
import { createTray, destroyTray } from "./services/tray";
import { restoreWindowBounds, trackWindowState } from "./services/window-state";

// Settings
import { settingsStore } from "./store";

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const bounds = restoreWindowBounds();

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: "#111827", // magic-surface 色，避免白屏闪烁
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: true,
    },
  });

  // 窗口状态记忆
  trackWindowState(win);

  // 优雅显示（避免白屏闪烁）
  win.on("ready-to-show", () => {
    if (settingsStore.get("startMinimized")) {
      // 启动最小化到托盘
    } else {
      win.show();
      win.focus();
    }
  });

  // 窗口状态变化通知 renderer
  win.on("maximize", () => win.webContents.send("window:state-changed", "maximized"));
  win.on("unmaximize", () => win.webContents.send("window:state-changed", "normal"));
  win.on("enter-full-screen", () => win.webContents.send("window:state-changed", "fullscreen"));
  win.on("leave-full-screen", () => win.webContents.send("window:state-changed", "normal"));

  // 外部链接在系统浏览器打开
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  // 阻止导航到外部页面
  win.webContents.on("will-navigate", (event, url) => {
    const rendererUrl = process.env["ELECTRON_RENDERER_URL"];
    if (rendererUrl && !url.startsWith(rendererUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // 加载页面
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return win;
}

app.whenReady().then(() => {
  mainWindow = createWindow();

  // 注册所有 IPC handler
  registerIPCHandlers(mainWindow, [
    createWindowHandlers(),
    createSettingsHandlers(),
    createShellHandlers(),
    createAppHandlers(),
    createNotifyHandlers(),
  ]);

  // 创建系统托盘
  createTray(mainWindow);

  // macOS: 点击 dock 图标恢复窗口
  app.on("activate", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      mainWindow = createWindow();
    }
  });
});

// 所有窗口关闭时不退出（由托盘控制退出）
app.on("window-all-closed", () => {
  // 不调用 app.quit()——应用在托盘中保持运行
  // 真正退出通过托盘菜单的"退出"按钮
});

app.on("before-quit", () => {
  destroyTray();
});

// macOS: 安全相关
app.on("web-contents-created", (_, contents) => {
  // 禁止新窗口
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
});
```

### 3.12 src/preload/index.ts — 完整桥接

```typescript
// apps/desktop/src/preload/index.ts
import { contextBridge, ipcRenderer } from "electron";
import type { IElectronAPI, AppSettings } from "@magic/shared-types";

const electronAPI: IElectronAPI = {
  // ---- Matrix（占位，004-auth-flow 填充）----
  matrixLogin: (homeserver, username, password) =>
    ipcRenderer.invoke("matrix:login", homeserver, username, password),
  matrixLogout: () => ipcRenderer.invoke("matrix:logout"),
  matrixRestoreSession: () => ipcRenderer.invoke("matrix:restore-session"),
  matrixSendMessage: (roomId, body, html) =>
    ipcRenderer.invoke("matrix:send-message", roomId, body, html),
  matrixSendFile: (roomId, filePath) =>
    ipcRenderer.invoke("matrix:send-file", roomId, filePath),

  // ---- 事件流 ----
  onMatrixEvent: (cb) => {
    const handler = (_event: any, data: any) => cb(data);
    ipcRenderer.on("matrix:event", handler);
    return () => ipcRenderer.off("matrix:event", handler);
  },
  onSyncStateChange: (cb) => {
    const handler = (_event: any, state: string) => cb(state);
    ipcRenderer.on("matrix:sync-state", handler);
    return () => ipcRenderer.off("matrix:sync-state", handler);
  },

  // ---- 设置 ----
  getSettings: () => ipcRenderer.invoke("settings:get") as Promise<AppSettings>,
  setSetting: (key, value) => ipcRenderer.invoke("settings:set", key, value),

  // ---- 窗口 ----
  windowMinimize: () => ipcRenderer.send("window:minimize"),
  windowMaximize: () => ipcRenderer.send("window:maximize"),
  windowClose: () => ipcRenderer.send("window:close"),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);
```

### 3.13 src/preload/index.d.ts — 全局类型声明

```typescript
// apps/desktop/src/preload/index.d.ts
import type { IElectronAPI } from "@magic/shared-types";

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
```

### 3.14 扩展 @magic/shared-types IPC 接口

在 `packages/shared-types/src/ipc-channels.ts` 中增加本 spec 新增的通道类型：

```typescript
// 追加到现有 IElectronAPI 接口
export interface IElectronAPI {
  // ... 已有的 Matrix / Settings / Window 方法 ...

  // 通知（003 新增）
  showNotification: (payload: NotifyPayload) => Promise<void>;
  onNotifyClicked: (cb: (data: { roomId?: string; eventId?: string }) => void) => () => void;

  // Shell（003 新增）
  openExternal: (url: string) => Promise<void>;
  openFileDialog: (options?: FileDialogOptions) => Promise<string[] | null>;
  saveFileDialog: (options?: SaveDialogOptions) => Promise<string | null>;

  // 应用信息（003 新增）
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;

  // 窗口状态（003 新增）
  isMaximized: () => Promise<boolean>;
  isFullscreen: () => Promise<boolean>;
  onWindowStateChanged: (cb: (state: "maximized" | "normal" | "fullscreen") => void) => () => void;
}

export interface NotifyPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  roomId?: string;
  eventId?: string;
}

export interface FileDialogOptions {
  filters?: { name: string; extensions: string[] }[];
  title?: string;
  defaultPath?: string;
  multiSelections?: boolean;
}

export interface SaveDialogOptions {
  filters?: { name: string; extensions: string[] }[];
  title?: string;
  defaultPath?: string;
}
```

### 3.15 React 侧 Hook 封装

```typescript
// packages/ui/src/hooks/useElectronAPI.ts

/**
 * 安全访问 window.electronAPI。
 * Web 端返回 null，桌面端返回 API 对象。
 */
export function useElectronAPI() {
  if (typeof window !== "undefined" && "electronAPI" in window) {
    return window.electronAPI;
  }
  return null;
}

/**
 * 判断当前是否在 Electron 环境中运行。
 */
export function isElectron(): boolean {
  return typeof window !== "undefined" && "electronAPI" in window;
}
```

---

## 4. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | `pnpm dev:desktop` 启动后窗口正常显示，macOS 有 hiddenInset 标题栏 | 手动验证 |
| AC-2 | 关闭窗口后应用不退出，最小化到系统托盘 | 手动验证 |
| AC-3 | 点击托盘图标恢复窗口 | 手动验证 |
| AC-4 | 托盘右键菜单显示"显示"和"退出" | 手动验证 |
| AC-5 | 在 renderer 中 `window.electronAPI.getSettings()` 返回正确的默认设置 | DevTools Console |
| AC-6 | `window.electronAPI.setSetting("theme", "dark")` 写入后，重启应用仍保留 | 手动验证 |
| AC-7 | 窗口位置/尺寸重启后恢复到上次关闭时的状态 | 手动验证 |
| AC-8 | `window.electronAPI.windowMinimize()` / `windowMaximize()` / `windowClose()` 正常工作 | DevTools Console |
| AC-9 | 所有外部链接（`target="_blank"` 或 `shell.openExternal`）在系统浏览器打开 | 手动验证 |
| AC-10 | `pnpm typecheck` 全局通过 | `pnpm typecheck` |
| AC-11 | `pnpm build` 全局通过 | `pnpm build` |

---

## 5. 实现任务（按执行顺序）

### 任务 1：安装依赖

**描述**：安装 electron-store。

**命令**：
```bash
cd apps/desktop && pnpm add electron-store@^10.0.0
```

**验证**：`pnpm install`

---

### 任务 2：创建 store.ts 本地设置

**描述**：创建 electron-store 实例。

**创建文件**：
- `src/main/store.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：创建 IPC 注册机制

**描述**：实现统一的 IPC handler 注册和错误处理。

**创建文件**：
- `src/main/ipc/registry.ts`

**验证**：`pnpm typecheck`

---

### 任务 4：创建窗口/设置/Shell/App IPC handler

**描述**：实现四个 IPC 模块。

**创建文件**：
- `src/main/ipc/window.ts`
- `src/main/ipc/settings.ts`
- `src/main/ipc/shell.ts`
- `src/main/ipc/app.ts`
- `src/main/ipc/notify.ts`

**验证**：`pnpm typecheck`

---

### 任务 5：创建系统托盘服务

**描述**：实现托盘图标、上下文菜单、单击切换可见性、未读角标。

**创建文件**：
- `src/main/services/tray.ts`

**验证**：`pnpm typecheck`

---

### 任务 6：创建窗口状态记忆服务

**描述**：实现窗口位置/尺寸的保存和恢复。

**创建文件**：
- `src/main/services/window-state.ts`

**验证**：`pnpm typecheck`

---

### 任务 7：重写 main/index.ts 完整入口

**描述**：替换 001 的最小入口为完整版本，集成所有 IPC handler 和 services。

**修改文件**：
- `src/main/index.ts`（完全重写）

**验证**：`pnpm dev:desktop`（窗口正常启动）

---

### 任务 8：更新 preload/index.ts 完整桥接

**描述**：替换 001 的占位桥接为完整版本。

**修改文件**：
- `src/preload/index.ts`（完全重写）
- `src/preload/index.d.ts`

**验证**：`pnpm typecheck`

---

### 任务 9：扩展 @magic/shared-types IPC 接口

**描述**：在 shared-types 中增加 003 新增的通道类型定义。

**修改文件**：
- `packages/shared-types/src/ipc-channels.ts`

**验证**：`pnpm typecheck`（全局）

---

### 任务 10：创建 useElectronAPI Hook

**描述**：在 @magic/ui 中创建平台感知的 API 访问 Hook。

**创建文件**：
- `packages/ui/src/hooks/useElectronAPI.ts`
- 更新 `packages/ui/src/index.ts` 导出

**验证**：`pnpm typecheck`

---

### 任务 11：全局集成验证

**描述**：从根目录确认整个 monorepo 正常。

**验证**：
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 验证 AC-1 到 AC-9
```

完成后提交：
```bash
git add -A
git commit -m "feat: 003 - electron shell with IPC, tray, notifications, window state"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 托盘图标文件在开发阶段不存在 | Tray 创建失败 | `createTray` 中 try-catch + `nativeImage.createEmpty()` 降级 |
| electron-store ESM 与 electron-vite 构建冲突 | import 报错 | electron-vite 的 `externalizeDepsPlugin()` 已处理 |
| macOS 公证后 Tray 图标路径变化 | 图标不显示 | 使用 `process.resourcesPath` + `app.isPackaged` 动态路径 |
| preload 中 Matrix IPC 占位会在调用时失败 | renderer 报错 | 004 前不在 UI 中调用 Matrix IPC，占位仅用于类型完整性 |

---

## 7. 后续 Spec 的接入点

- **004-auth-flow**：在 `src/main/ipc/` 新增 `matrix.ts` 注册 `matrix:login` 等 handler（或决定将 MatrixClient 完全放在 renderer——此时 main 进程不需要 Matrix IPC，仅需通知桥接）
- **009-file-attachments**：使用 `shell:open-file-dialog` 选择文件后传给 renderer 的 `uploadAndSendFile()`
- **012-notifications-tray**：扩展 `notify.ts` 支持消息预览、批量通知、DND 模式；扩展 `tray.ts` 未读角标实时更新
- **013-auto-update**：在 `src/main/services/` 新增 `updater.ts`，注册 `update:*` IPC 通道