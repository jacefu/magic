# Electron 安全规则

## 强制要求

所有 BrowserWindow 必须启用以下安全配置：

```typescript
webPreferences: {
  preload: join(__dirname, "../preload/index.js"),
  sandbox: true,          // 必须
  contextIsolation: true, // 必须
  nodeIntegration: false, // 必须为 false
}
```

## contextBridge 规则

- **禁止**直接暴露 `ipcRenderer` 对象到 renderer
- **必须**通过 `contextBridge.exposeInMainWorld` 封装具名函数
- 每个暴露的函数必须在 `@magic/shared-types` 的 `IElectronAPI` 接口中声明

```typescript
// ✅ 正确
contextBridge.exposeInMainWorld("electronAPI", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
});

// ❌ 禁止
contextBridge.exposeInMainWorld("ipcRenderer", ipcRenderer);
```

## IPC 通道命名

格式：`domain:action`

| 示例 | 说明 |
|------|------|
| `matrix:login` | Matrix 登录 |
| `settings:get` | 读取设置 |
| `window:minimize` | 窗口最小化 |

## 外部链接

所有外部 URL 必须通过 `shell.openExternal` 在系统浏览器打开，并拦截 `setWindowOpenHandler`：

```typescript
mainWindow.webContents.setWindowOpenHandler((details) => {
  shell.openExternal(details.url);
  return { action: "deny" };
});
```

## 生产环境

- 禁止在生产环境跳过 E2EE
- 禁止在代码中硬编码凭证或 access token
- 敏感数据使用系统 keychain（electron-keytar）存储
