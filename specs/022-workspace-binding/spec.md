# Spec 022: 对话本地文件夹绑定（按需读取版）

> 优先级: P0 | 波次: Wave 6 | 预估: 4-5 天 | 前置依赖: 003-electron-shell, 005-room-list, 020-ui-polish, 021-room-settings
> 文件路径: `specs/022-workspace-binding/spec.md`

---

## 1. 目标

为 Magic 客户端的**所有对话场景**（群聊房间 + 与 Agent 私聊）增加**本地文件夹绑定**能力，类似 Claude Cowork 的 "Choose a folder" 功能。

### 关键设计原则（与上一版的根本区别）

| 维度 | ❌ 旧设计（已废弃） | ✅ 新设计 |
|------|---------------------|----------|
| **后端依赖** | 需要 Magic 后端 + MinIO 存储服务 | **零后端依赖**——纯 Matrix 协议 + 客户端本地访问 |
| **数据流** | 全量同步：本地 → 服务端 → Agent 容器 | **按需拉取**：Agent 需要时通过 Matrix 请求，客户端实时返回 |
| **存储位置** | 文件副本存储在 MinIO | **文件永远只在用户本地磁盘**，不复制 |
| **网络流量** | 绑定时上传全部文件（可能数百 MB） | 仅传输 Agent 实际请求的文件（通常 < 1%） |
| **隐私** | Agent 容器持久化访问所有文件 | Agent 仅在请求-响应窗口期看到内容，过后即"忘记" |
| **可用性要求** | 离线也能读（已同步） | 需要 Magic 客户端在线 |

### 核心工作流

```
1. 用户绑定本地文件夹 → Magic 客户端获取本地读取权限
2. Magic 客户端扫描文件夹 → 通过 Matrix state event 把"文件清单"发布到对话
3. 对话中的 Agent 看到清单 → 知道有哪些文件、路径、大小
4. Agent 决定要读某个文件 → 发送 Matrix message event(read_request)
5. Magic 客户端收到请求 → 从本地磁盘读取文件
6. Magic 客户端回复 Matrix message event(read_response，含文件内容)
7. Agent 把文件内容拼进 LLM 的 Prompt → 完成任务
```

### 用户故事

- **私聊场景（核心）**：作为开发者，我把本地代码仓库绑定到与 Worker Agent 的私聊。Agent 看到 142 个文件的清单，需要审查 `src/auth.py` 时主动请求，我的客户端实时返回文件内容。文件**从未离开我的电脑**，只在 Agent 当时需要时被读取一次。
- **群聊场景**：在群聊房间绑定需求文档文件夹，房间内任意 Agent 都能看到清单并按需读取。
- **混合场景**：同一文件夹可同时绑定到多个对话，每个对话独立维护读取请求/响应通道。

---

## 2. 架构设计

### 2.1 整体架构（极简版，无后端）

```
┌─────────────────────────────────────────────────────────────┐
│                     Magic Desktop (Electron)                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Main Process                                         │  │
│  │  ├── FolderPicker (dialog.showOpenDialog)             │  │
│  │  ├── WorkspaceRegistry (per-room binding store)       │  │
│  │  ├── FileWatcher (chokidar)                           │  │
│  │  ├── IgnoreEngine (.magicignore + defaults)           │  │
│  │  ├── FileTreePublisher (向 Matrix 发布清单)           │  │
│  │  └── FileAccessHandler (响应 Agent 的读取请求)        │  │
│  └────────────────────┬──────────────────────────────────┘  │
│                       │ IPC                                  │
│  ┌────────────────────▼──────────────────────────────────┐  │
│  │  Renderer Process                                     │  │
│  │  ├── BindFolderButton (in MessageComposer +)          │  │
│  │  ├── WorkspaceSection (在右侧设置面板中)              │  │
│  │  ├── WorkspaceIndicator (ChannelHeader 中的小图标)    │  │
│  │  └── Matrix client (matrix-js-sdk)                    │  │
│  │      ├── 发送 state event 通告绑定                     │  │
│  │      ├── 监听 read_request 事件                        │  │
│  │      └── 发送 read_response 事件                       │  │
│  └────────────────────┬──────────────────────────────────┘  │
└────────────────────────┼─────────────────────────────────────┘
                         │ Matrix 协议（仅此一条通道）
       ┌─────────────────▼──────────────────┐
       │      Matrix Homeserver (Tuwunel)   │
       │  房间事件流转、消息加密、成员鉴权    │
       └─────────────────┬──────────────────┘
                         │
       ┌─────────────────▼──────────────────┐
       │      Agent Container (Worker)      │
       │  ├── Matrix client (matrix-js-sdk) │
       │  ├── 看到 state event 中的文件清单  │
       │  ├── 发送 read_request 索取文件     │
       │  ├── 接收 read_response 拿到内容    │
       │  └── 文件内容拼进 LLM Prompt        │
       └────────────────────────────────────┘

⚠ 完全没有 MinIO、没有独立后端、没有 HTTP API
   一切走 Matrix 协议，与现有基础设施零侵入
```

### 2.2 路径与命名空间

由于文件不离开本地，**没有路径映射问题**：

| 层级 | 表示 |
|------|------|
| 用户本地 | `/Users/alice/Projects/myapp/src/main.py`（绝对路径，仅本地存储中可见） |
| Matrix 协议中 | `src/main.py`（**只用相对路径**，不暴露用户隐私） |
| Agent 看到的 | `src/main.py`（与 Matrix 协议层一致） |

⚠️ Agent 永远不知道用户的真实绝对路径，只看到相对于绑定根的相对路径。

---

## 3. Matrix 协议扩展

### 3.1 State event：文件清单（绑定通告）

事件类型：`com.magic.workspace.binding`
state_key：发起绑定的用户 ID（每个用户独立，多人可分别绑定）

```json
{
  "type": "com.magic.workspace.binding",
  "state_key": "@alice:matrix.example.com",
  "content": {
    "bound": true,
    "displayName": "myapp",
    "boundBy": "@alice:matrix.example.com",
    "boundAt": 1746876000000,
    "fileCount": 142,
    "totalSize": 2456789,
    "tree": [
      { "path": "README.md", "size": 1024, "mtime": 1746875000000 },
      { "path": "src/main.py", "size": 5678, "mtime": 1746876000000 },
      { "path": "src/utils.py", "size": 2345, "mtime": 1746875500000 },
      { "path": "tests/test_main.py", "size": 1500, "mtime": 1746874000000 }
    ],
    "treeChunked": false
  }
}
```

⚠️ **大小限制**：Matrix 单个 state event 内容上限约 64 KB。对于文件数过多（>500）的文件夹：

```json
{
  "bound": true,
  "displayName": "monorepo",
  "fileCount": 5234,
  "totalSize": 125000000,
  "tree": null,
  "treeChunked": true,
  "treeChunks": 6,
  "treeManifestEventIds": ["$evt1", "$evt2", "..."]
}
```

清单分片通过 message event `com.magic.workspace.tree_chunk` 发送，Agent 拼装。

### 3.2 Message event：文件读取请求/响应

#### 请求（Agent → 客户端）

事件类型：`com.magic.workspace.read_request`

```json
{
  "type": "com.magic.workspace.read_request",
  "content": {
    "request_id": "req-7f3a9b2c",
    "path": "src/main.py",
    "encoding": "auto",
    "max_size": 1048576,
    "binding_owner": "@alice:matrix.example.com"
  }
}
```

字段说明：
- `request_id`：唯一标识，响应时回填
- `path`：要读取的相对路径
- `encoding`：`"utf-8"` / `"base64"` / `"auto"`（auto 让客户端自动判断）
- `max_size`：最大字节数（防止意外读取超大文件，默认 1MB，硬上限 10MB）
- `binding_owner`：要请求哪个用户的绑定（多人绑定场景下指定）

#### 响应（客户端 → Agent）

事件类型：`com.magic.workspace.read_response`，作为 reply 关联到 request：

```json
{
  "type": "com.magic.workspace.read_response",
  "content": {
    "request_id": "req-7f3a9b2c",
    "path": "src/main.py",
    "ok": true,
    "encoding": "utf-8",
    "size": 5678,
    "content": "from flask import Flask\napp = Flask(__name__)\n...",
    "mtime": 1746876000000,
    "m.relates_to": {
      "rel_type": "m.reference",
      "event_id": "$requestEventId"
    }
  }
}
```

错误响应：

```json
{
  "type": "com.magic.workspace.read_response",
  "content": {
    "request_id": "req-7f3a9b2c",
    "path": "src/main.py",
    "ok": false,
    "error": "file_not_found" | "permission_denied" | "size_exceeded" | "owner_offline" | "binding_unbound",
    "errorMessage": "可读的错误描述"
  }
}
```

#### 大文件传输

如果文件超过 32 KB（Matrix 消息体推荐上限），改用 Matrix media API：

```json
{
  "type": "com.magic.workspace.read_response",
  "content": {
    "request_id": "req-7f3a9b2c",
    "path": "src/main.py",
    "ok": true,
    "size": 524288,
    "via_media": true,
    "mxc_url": "mxc://matrix.example.com/abc123def456",
    "mime_type": "text/x-python",
    "encoding": "utf-8"
  }
}
```

Agent 通过标准 Matrix media API（`/_matrix/media/v3/download/...`）下载实际内容。
媒体上传走的是 Homeserver 自带的 media repo，**仍然不需要独立后端**。

### 3.3 Message event：列出目录（可选）

对于 chunked 清单或 Agent 想浏览特定子目录的场景：

```json
{
  "type": "com.magic.workspace.list_request",
  "content": {
    "request_id": "req-list-1",
    "path": "src/",
    "depth": 1,
    "binding_owner": "@alice:matrix.example.com"
  }
}
```

响应类似 read_response，content 包含 `entries: Array<{path, size, mtime, isDirectory}>`。

### 3.4 写入请求（v2 范围，本 spec 不实现）

```
com.magic.workspace.write_request:  Agent 请求写入
com.magic.workspace.write_response: 客户端确认（可能弹出用户审批 UI）
```

v1 阶段保持只读，确保功能稳定后再开放写入。

---

## 4. UI/UX 设计

### 4.1 入口位置

**主入口：MessageComposer 的 + 按钮菜单**（不变）

```
[+] → 弹出菜单：
       📎 上传文件
       📁 绑定本地文件夹  ← 新增
       🖼  插入图片
```

**辅助入口：ChannelHeader 状态指示器**（不变，群聊和私聊都显示）

```
群聊：# room-name | room-topic       📁 myapp · 142 files  [⚙]
私聊：@ manager 💕                    📁 myapp · 142 files  [⚙]
```

**管理入口：设置面板的"工作区"模块**（群聊 RoomSettingsPanel + 私聊 DMSettingsPanel 都有）

### 4.2 绑定流程（简化，无上传步骤）

```
1. 用户点击 [+] → 选择"绑定本地文件夹"
2. 弹出原生文件选择对话框（Electron dialog.showOpenDialog）
3. 用户选择文件夹 /Users/alice/Projects/myapp
4. 弹出确认对话框 BindFolderConfirmDialog：

   私聊上下文：
   ┌──────────────────────────────────────────┐
   │ 绑定本地文件夹到此对话？                  │
   ├──────────────────────────────────────────┤
   │ 📁 myapp                                 │
   │ /Users/alice/Projects/myapp              │
   │                                          │
   │ 扫描到 142 个文件 (2.4 MB)               │
   │ 已自动忽略：node_modules, .git, .env     │
   │                                          │
   │ 工作方式：                                │
   │ ✓ 文件保留在你的电脑上，不上传到任何服务器│  ← 新增亮点
   │ ✓ manager 看到清单后，可按需请求读取文件 │
   │ ✓ Magic 离线时 manager 无法访问文件       │
   │                                          │
   │ ☐ 我理解上述说明                          │
   │                                          │
   │            [取消]  [绑定]                  │
   └──────────────────────────────────────────┘

5. 用户确认 → 客户端扫描文件夹（秒级完成，仅遍历不读内容）
6. 发布 Matrix state event（文件清单）→ Agent 立即看到
7. 启动 chokidar 监听本地变化
8. 启动 Matrix 事件订阅，等待 read_request

⚠ 整个流程没有"上传进度"环节，因为根本不上传
```

### 4.3 同步状态视图

WorkspacePanel 中的状态指示：

| 状态 | 图标 | 描述 |
|------|------|------|
| 未绑定 | — | "尚未绑定本地文件夹" + [绑定文件夹] 按钮 |
| 已绑定 · 在线 | ✅ | "已绑定 142 个文件，Agent 可访问" |
| 已绑定 · 离线 | 🌙 | "已绑定 但 Magic 离线，Agent 暂时无法读取文件" |
| 文件夹被移动/删除 | ⚠️ | "本地文件夹找不到了" + [重新绑定/解绑] |
| 刚响应了请求 | 📖 | "刚才 manager 读取了 src/main.py（2 秒前）"（短暂显示） |

### 4.4 访问审计视图（隐私保障）

为让用户随时知道 Agent 读了哪些文件，在 WorkspaceSection 增加**访问日志**：

```
最近访问记录：
━━━━━━━━━━━━━━━━━━━━━━━━━
📖 manager · 读取 src/auth.py · 2 分钟前
📖 manager · 读取 src/main.py · 5 分钟前
📋 manager · 列出 tests/ · 8 分钟前
━━━━━━━━━━━━━━━━━━━━━━━━━
[查看完整记录]
```

记录持久化在客户端本地（不上链）。

---

## 5. 技术规格

### 5.1 Electron 主进程

#### 5.1.1 IPC 接口

```typescript
// apps/desktop/src/main/ipc/workspace.ts
import { ipcMain, dialog, BrowserWindow } from "electron";
import { WorkspaceManager } from "../workspace/WorkspaceManager";

export function registerWorkspaceIpcHandlers(workspace: WorkspaceManager) {
  ipcMain.handle("workspace:pickFolder", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
      title: "选择要绑定的本地文件夹",
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("workspace:scanFolder", async (_e, folderPath: string) =>
    workspace.scanFolder(folderPath)
  );

  ipcMain.handle("workspace:bind", async (_e, roomId: string, folderPath: string) =>
    workspace.bind(roomId, folderPath)
  );

  ipcMain.handle("workspace:unbind", async (_e, roomId: string) =>
    workspace.unbind(roomId)
  );

  ipcMain.handle("workspace:getBinding", async (_e, roomId: string) =>
    workspace.getBinding(roomId)
  );

  ipcMain.handle("workspace:getAllBindings", async () =>
    workspace.getAllBindings()
  );

  ipcMain.handle("workspace:revealInFinder", async (_e, roomId: string) =>
    workspace.revealInFinder(roomId)
  );

  // ⭐ 新增：响应 read_request 的核心接口
  ipcMain.handle("workspace:readFile",
    async (_e, roomId: string, relPath: string, maxSize: number, requesterId: string) =>
      workspace.readFile(roomId, relPath, maxSize, requesterId)
  );

  ipcMain.handle("workspace:listDir",
    async (_e, roomId: string, relPath: string, depth: number, requesterId: string) =>
      workspace.listDir(roomId, relPath, depth, requesterId)
  );

  ipcMain.handle("workspace:getAccessLog",
    async (_e, roomId: string, limit: number) =>
      workspace.getAccessLog(roomId, limit)
  );
}
```

#### 5.1.2 WorkspaceManager（核心）

```typescript
// apps/desktop/src/main/workspace/WorkspaceManager.ts
import * as path from "path";
import * as fs from "fs/promises";
import { app, shell, BrowserWindow } from "electron";
import chokidar, { FSWatcher } from "chokidar";
import { IgnoreEngine } from "./IgnoreEngine";

interface Binding {
  roomId: string;
  localPath: string;
  displayName: string;
  boundBy: string;
  boundAt: number;
  fileCount: number;
  totalSize: number;
  ignorePatterns: string[];
}

interface FileEntry {
  path: string;
  size: number;
  mtime: number;
}

interface AccessLogEntry {
  timestamp: number;
  type: "read" | "list";
  path: string;
  agentUserId: string;
  bytes: number;
  success: boolean;
}

interface ScanResult {
  fileCount: number;
  totalSize: number;
  ignoredCount: number;
  files: FileEntry[];
  truncated: boolean;
}

export class WorkspaceManager {
  private bindings: Map<string, Binding> = new Map();
  private watchers: Map<string, FSWatcher> = new Map();
  private accessLogs: Map<string, AccessLogEntry[]> = new Map();
  private storageFile: string;
  private accessLogFile: string;
  private onFileTreeChanged: (roomId: string, files: FileEntry[]) => void;

  private readonly DEFAULT_IGNORES = [
    "node_modules/**", ".git/**", ".svn/**", ".hg/**",
    "dist/**", "build/**", "out/**", "target/**",
    "__pycache__/**", ".venv/**", "venv/**",
    ".env", ".env.*", "*.log", "*.tmp", "*.cache",
    ".DS_Store", "Thumbs.db",
    ".idea/**", ".vscode/**",
    "*.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    ".ssh/**", ".aws/**", ".gnupg/**",
    "*.pem", "*.key", "*.p12", "*.pfx", "id_rsa*",
  ];

  // 单文件读取上限：10 MB
  private readonly MAX_READ_SIZE = 10 * 1024 * 1024;

  // 总文件数硬上限
  private readonly MAX_FILE_COUNT = 10000;

  // 文件夹总大小元数据上限：5 GB（不限实际读取，仅扫描）
  private readonly MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024;

  constructor(onFileTreeChanged: (roomId: string, files: FileEntry[]) => void) {
    this.storageFile = path.join(app.getPath("userData"), "workspaces.json");
    this.accessLogFile = path.join(app.getPath("userData"), "workspace-access-log.json");
    this.onFileTreeChanged = onFileTreeChanged;
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.storageFile, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed.bindings) {
        for (const [roomId, b] of Object.entries(parsed.bindings)) {
          this.bindings.set(roomId, b as Binding);
        }
      }
    } catch {}

    try {
      const data = await fs.readFile(this.accessLogFile, "utf-8");
      const parsed = JSON.parse(data);
      for (const [roomId, logs] of Object.entries(parsed)) {
        this.accessLogs.set(roomId, logs as AccessLogEntry[]);
      }
    } catch {}

    // 恢复文件监听
    for (const [roomId, binding] of this.bindings.entries()) {
      try {
        await fs.access(binding.localPath);
        await this.startWatching(roomId, binding);
      } catch {
        console.warn(`绑定路径不存在: ${binding.localPath}`);
      }
    }
  }

  private async save(): Promise<void> {
    const data = {
      version: 2,
      bindings: Object.fromEntries(this.bindings.entries()),
    };
    await fs.writeFile(this.storageFile, JSON.stringify(data, null, 2));
  }

  /**
   * 扫描文件夹，返回文件清单（仅元数据，不读内容）
   */
  async scanFolder(folderPath: string): Promise<ScanResult> {
    const ignore = new IgnoreEngine(this.DEFAULT_IGNORES);
    try {
      const ignoreFile = await fs.readFile(
        path.join(folderPath, ".magicignore"), "utf-8"
      );
      ignore.addPatterns(ignoreFile.split("\n"));
    } catch {}

    const files: FileEntry[] = [];
    let totalSize = 0;
    let ignoredCount = 0;
    let truncated = false;

    const walk = async (dir: string): Promise<void> => {
      if (truncated) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (truncated) break;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(folderPath, fullPath).replace(/\\/g, "/");

        if (ignore.matches(relPath)) {
          ignoredCount++;
          continue;
        }

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          try {
            const stat = await fs.stat(fullPath);
            files.push({
              path: relPath,
              size: stat.size,
              mtime: stat.mtimeMs,
            });
            totalSize += stat.size;

            if (files.length >= this.MAX_FILE_COUNT) {
              truncated = true;
              break;
            }
            if (totalSize >= this.MAX_TOTAL_SIZE) {
              truncated = true;
              break;
            }
          } catch {}
        }
      }
    };

    await walk(folderPath);

    return { fileCount: files.length, totalSize, ignoredCount, files, truncated };
  }

  /**
   * 绑定文件夹（只在本地登记，不上传）
   */
  async bind(roomId: string, folderPath: string, boundBy: string): Promise<Binding> {
    const stat = await fs.stat(folderPath);
    if (!stat.isDirectory()) throw new Error("选择的不是文件夹");

    if (this.bindings.has(roomId)) {
      await this.unbind(roomId);
    }

    const scan = await this.scanFolder(folderPath);

    const binding: Binding = {
      roomId,
      localPath: folderPath,
      displayName: path.basename(folderPath),
      boundBy,
      boundAt: Date.now(),
      fileCount: scan.fileCount,
      totalSize: scan.totalSize,
      ignorePatterns: this.DEFAULT_IGNORES,
    };

    this.bindings.set(roomId, binding);
    await this.save();

    // 通知 renderer 发布 Matrix state event
    this.onFileTreeChanged(roomId, scan.files);

    // 启动文件监听
    await this.startWatching(roomId, binding);

    this.notifyBindingChange(roomId, binding);

    return binding;
  }

  async unbind(roomId: string): Promise<void> {
    const watcher = this.watchers.get(roomId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(roomId);
    }
    this.bindings.delete(roomId);
    await this.save();

    // 通知 renderer 清空 state event
    this.onFileTreeChanged(roomId, []);

    this.notifyBindingChange(roomId, null);
  }

  getBinding(roomId: string): Binding | null {
    return this.bindings.get(roomId) ?? null;
  }

  getAllBindings(): Binding[] {
    return Array.from(this.bindings.values());
  }

  revealInFinder(roomId: string): void {
    const binding = this.bindings.get(roomId);
    if (binding) shell.openPath(binding.localPath);
  }

  /**
   * ⭐ 核心：响应 Agent 的文件读取请求
   */
  async readFile(
    roomId: string,
    relPath: string,
    maxSize: number = this.MAX_READ_SIZE,
    requesterId: string = "unknown"
  ): Promise<{
    ok: boolean;
    content?: Buffer;
    encoding?: "utf-8" | "base64";
    size?: number;
    mtime?: number;
    error?: string;
    errorMessage?: string;
  }> {
    const binding = this.bindings.get(roomId);
    if (!binding) {
      this.logAccess(roomId, requesterId, "read", relPath, 0, false);
      return { ok: false, error: "binding_unbound", errorMessage: "对话未绑定文件夹" };
    }

    // 路径安全校验
    const safe = this.resolveSafePath(binding.localPath, relPath);
    if (!safe) {
      this.logAccess(roomId, requesterId, "read", relPath, 0, false);
      return { ok: false, error: "permission_denied", errorMessage: "路径越界" };
    }

    // 忽略列表校验
    const ignore = new IgnoreEngine(binding.ignorePatterns);
    if (ignore.matches(relPath)) {
      this.logAccess(roomId, requesterId, "read", relPath, 0, false);
      return { ok: false, error: "permission_denied", errorMessage: "文件被忽略列表排除" };
    }

    try {
      const stat = await fs.stat(safe);
      if (!stat.isFile()) {
        return { ok: false, error: "file_not_found", errorMessage: "不是文件" };
      }
      const cap = Math.min(maxSize, this.MAX_READ_SIZE);
      if (stat.size > cap) {
        this.logAccess(roomId, requesterId, "read", relPath, 0, false);
        return {
          ok: false,
          error: "size_exceeded",
          errorMessage: `文件 ${stat.size} 字节超过上限 ${cap}`,
        };
      }

      const content = await fs.readFile(safe);
      const encoding = this.detectEncoding(content);

      this.logAccess(roomId, requesterId, "read", relPath, content.length, true);

      return {
        ok: true,
        content,
        encoding,
        size: content.length,
        mtime: stat.mtimeMs,
      };
    } catch (err: any) {
      this.logAccess(roomId, requesterId, "read", relPath, 0, false);
      if (err.code === "ENOENT") {
        return { ok: false, error: "file_not_found", errorMessage: "文件不存在" };
      }
      return { ok: false, error: "permission_denied", errorMessage: err.message };
    }
  }

  /**
   * 列出指定子目录
   */
  async listDir(
    roomId: string,
    relPath: string,
    depth: number = 1,
    requesterId: string = "unknown"
  ): Promise<{
    ok: boolean;
    entries?: Array<{ path: string; size: number; mtime: number; isDirectory: boolean }>;
    error?: string;
  }> {
    const binding = this.bindings.get(roomId);
    if (!binding) return { ok: false, error: "binding_unbound" };

    const safe = this.resolveSafePath(binding.localPath, relPath);
    if (!safe) return { ok: false, error: "permission_denied" };

    const ignore = new IgnoreEngine(binding.ignorePatterns);
    const entries: Array<{ path: string; size: number; mtime: number; isDirectory: boolean }> = [];

    const walk = async (dir: string, currentDepth: number): Promise<void> => {
      if (currentDepth > depth) return;
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        const itemRel = path.relative(binding.localPath, fullPath).replace(/\\/g, "/");
        if (ignore.matches(itemRel)) continue;
        try {
          const stat = await fs.stat(fullPath);
          entries.push({
            path: itemRel,
            size: stat.size,
            mtime: stat.mtimeMs,
            isDirectory: item.isDirectory(),
          });
          if (item.isDirectory() && currentDepth < depth) {
            await walk(fullPath, currentDepth + 1);
          }
        } catch {}
      }
    };

    await walk(safe, 0);

    this.logAccess(roomId, requesterId, "list", relPath, 0, true);

    return { ok: true, entries };
  }

  /**
   * 路径安全解析：防止 path traversal
   */
  private resolveSafePath(rootPath: string, relPath: string): string | null {
    const normalized = path.normalize(relPath).replace(/^[/\\]+/, "");
    const resolved = path.resolve(rootPath, normalized);
    if (!resolved.startsWith(rootPath + path.sep) && resolved !== rootPath) {
      return null;
    }
    return resolved;
  }

  private detectEncoding(content: Buffer): "utf-8" | "base64" {
    const sample = content.slice(0, 8192);
    try {
      const decoded = sample.toString("utf-8");
      const replacementCount = (decoded.match(/\uFFFD/g) || []).length;
      if (replacementCount > sample.length * 0.01) return "base64";
      if (sample.includes(0)) return "base64";
      return "utf-8";
    } catch {
      return "base64";
    }
  }

  private async logAccess(
    roomId: string,
    agentUserId: string,
    type: "read" | "list",
    relPath: string,
    bytes: number,
    success: boolean
  ): Promise<void> {
    const log = this.accessLogs.get(roomId) ?? [];
    const entry = {
      timestamp: Date.now(),
      type,
      path: relPath,
      agentUserId,
      bytes,
      success,
    };
    log.push(entry);
    if (log.length > 200) log.splice(0, log.length - 200);
    this.accessLogs.set(roomId, log);

    const allLogs = Object.fromEntries(this.accessLogs.entries());
    fs.writeFile(this.accessLogFile, JSON.stringify(allLogs)).catch(() => {});

    this.notifyAccessLog(roomId, entry);
  }

  getAccessLog(roomId: string, limit: number = 50): AccessLogEntry[] {
    const log = this.accessLogs.get(roomId) ?? [];
    return log.slice(-limit).reverse();
  }

  /**
   * 启动文件监听 — 变化时重新发布清单
   */
  private async startWatching(roomId: string, binding: Binding): Promise<void> {
    const ignore = new IgnoreEngine(binding.ignorePatterns);
    const watcher = chokidar.watch(binding.localPath, {
      ignored: (filePath: string) => {
        const rel = path.relative(binding.localPath, filePath).replace(/\\/g, "/");
        return rel ? ignore.matches(rel) : false;
      },
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    let debounceTimer: NodeJS.Timeout | null = null;
    const triggerRepublish = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const scan = await this.scanFolder(binding.localPath);
        binding.fileCount = scan.fileCount;
        binding.totalSize = scan.totalSize;
        await this.save();
        this.onFileTreeChanged(roomId, scan.files);
        this.notifyBindingChange(roomId, binding);
      }, 2000); // 2 秒防抖
    };

    watcher.on("add", triggerRepublish);
    watcher.on("change", triggerRepublish);
    watcher.on("unlink", triggerRepublish);

    this.watchers.set(roomId, watcher);
  }

  private notifyBindingChange(roomId: string, binding: Binding | null): void {
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("workspace:binding-changed", { roomId, binding })
    );
  }

  private notifyAccessLog(roomId: string, entry: AccessLogEntry): void {
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("workspace:access-logged", { roomId, entry })
    );
  }

  async shutdown(): Promise<void> {
    for (const w of this.watchers.values()) {
      await w.close();
    }
    this.watchers.clear();
  }
}
```

#### 5.1.3 IgnoreEngine

沿用上一版 spec 的 minimatch 实现。

### 5.2 Renderer 端 — Matrix 协议处理

#### 5.2.1 useWorkspaceMatrixBridge — 核心桥接 Hook

```typescript
// packages/ui/src/hooks/useWorkspaceMatrixBridge.ts
import { useEffect } from "react";
import { getClient } from "@magic/matrix-client";

/**
 * App 顶层挂载，负责：
 * 1. 监听 main 进程的"文件清单变化" → 发布 Matrix state event
 * 2. 监听 Matrix Room.timeline 的 read_request/list_request
 *    → 调用 main 进程读文件 → 发回 read_response/list_response
 */
export function useWorkspaceMatrixBridge() {
  useEffect(() => {
    const client = getClient();
    if (!client) return;

    // === 1. main 进程通知文件清单变化 → 发布 state event ===
    const fileTreeHandler = async (
      _e: any,
      { roomId, files }: { roomId: string; files: any[] }
    ) => {
      const userId = client.getUserId();
      if (!userId) return;

      try {
        if (files.length === 0) {
          // 解绑：清空 state event
          await client.sendStateEvent(
            roomId,
            "com.magic.workspace.binding",
            { bound: false },
            userId
          );
          return;
        }

        // 决定是否需要 chunked 模式
        const inlineLimit = 500;
        const useChunked = files.length > inlineLimit;
        const binding = await window.electron!.workspace.getBinding(roomId);

        if (!useChunked) {
          await client.sendStateEvent(
            roomId,
            "com.magic.workspace.binding",
            {
              bound: true,
              displayName: binding?.displayName ?? "",
              boundBy: userId,
              boundAt: binding?.boundAt ?? Date.now(),
              fileCount: files.length,
              totalSize: files.reduce((sum, f) => sum + f.size, 0),
              tree: files,
              treeChunked: false,
            },
            userId
          );
        } else {
          // Chunked 模式：先发 message events，再 state event 引用
          const CHUNK_SIZE = 200;
          const chunkEventIds: string[] = [];
          for (let i = 0; i < files.length; i += CHUNK_SIZE) {
            const chunk = files.slice(i, i + CHUNK_SIZE);
            const result = await client.sendEvent(roomId, "com.magic.workspace.tree_chunk", {
              chunkIndex: Math.floor(i / CHUNK_SIZE),
              totalChunks: Math.ceil(files.length / CHUNK_SIZE),
              files: chunk,
            });
            chunkEventIds.push(result.event_id);
          }
          await client.sendStateEvent(
            roomId,
            "com.magic.workspace.binding",
            {
              bound: true,
              displayName: binding?.displayName ?? "",
              boundBy: userId,
              boundAt: binding?.boundAt ?? Date.now(),
              fileCount: files.length,
              totalSize: files.reduce((sum, f) => sum + f.size, 0),
              tree: null,
              treeChunked: true,
              treeChunks: chunkEventIds.length,
              treeManifestEventIds: chunkEventIds,
            },
            userId
          );
        }
      } catch (err) {
        console.error("发布文件清单失败:", err);
      }
    };

    const unsubFileTree = window.electron?.workspace.onFileTreeChanged?.(fileTreeHandler);

    // === 2. 监听 Matrix Room.timeline 的 read_request ===
    const handleTimelineEvent = async (event: any) => {
      const myUserId = client.getUserId();
      const senderId = event.getSender();
      if (senderId === myUserId) return; // 忽略自己

      const eventType = event.getType();
      const roomId = event.getRoomId();
      if (!roomId) return;

      if (eventType === "com.magic.workspace.read_request") {
        const content = event.getContent();
        // 校验请求是否针对我（多人绑定时通过 binding_owner 路由）
        if (content.binding_owner && content.binding_owner !== myUserId) return;

        const binding = await window.electron!.workspace.getBinding(roomId);
        if (!binding || binding.boundBy !== myUserId) return;

        const result = await window.electron!.workspace.readFile(
          roomId, content.path, content.max_size ?? 1048576, senderId
        );

        const responseContent: any = {
          request_id: content.request_id,
          path: content.path,
          ok: result.ok,
          "m.relates_to": {
            rel_type: "m.reference",
            event_id: event.getId(),
          },
        };

        if (result.ok && result.content) {
          const SMALL_THRESHOLD = 32 * 1024;
          if (result.content.length > SMALL_THRESHOLD) {
            // 大文件走 Matrix media upload
            const blob = new Blob([result.content]);
            const uploadRes = await client.uploadContent(blob, {
              type: result.encoding === "utf-8" ? "text/plain" : "application/octet-stream",
              name: content.path.split("/").pop() ?? "file",
            });
            Object.assign(responseContent, {
              via_media: true,
              mxc_url: uploadRes.content_uri,
              mime_type: result.encoding === "utf-8" ? "text/plain" : "application/octet-stream",
              size: result.size,
              encoding: result.encoding,
              mtime: result.mtime,
            });
          } else {
            // 小文件内联
            Object.assign(responseContent, {
              via_media: false,
              size: result.size,
              encoding: result.encoding,
              content: result.encoding === "utf-8"
                ? (result.content as Buffer).toString("utf-8")
                : (result.content as Buffer).toString("base64"),
              mtime: result.mtime,
            });
          }
        } else {
          responseContent.error = result.error;
          responseContent.errorMessage = result.errorMessage;
        }

        await client.sendEvent(roomId, "com.magic.workspace.read_response", responseContent);
      } else if (eventType === "com.magic.workspace.list_request") {
        const content = event.getContent();
        if (content.binding_owner && content.binding_owner !== myUserId) return;

        const binding = await window.electron!.workspace.getBinding(roomId);
        if (!binding || binding.boundBy !== myUserId) return;

        const result = await window.electron!.workspace.listDir(
          roomId, content.path ?? "", content.depth ?? 1, senderId
        );

        await client.sendEvent(roomId, "com.magic.workspace.list_response", {
          request_id: content.request_id,
          path: content.path,
          ok: result.ok,
          entries: result.entries,
          error: result.error,
          "m.relates_to": { rel_type: "m.reference", event_id: event.getId() },
        });
      }
    };

    client.on("Room.timeline", handleTimelineEvent);

    return () => {
      unsubFileTree?.();
      client.off("Room.timeline", handleTimelineEvent);
    };
  }, []);
}
```

#### 5.2.2 在 App 入口挂载 Bridge

```tsx
// apps/desktop/src/renderer/src/App.tsx
import { useWorkspaceMatrixBridge } from "@magic/ui/hooks";

function App() {
  // 登录后挂载（可放在 AuthGuard 后）
  useWorkspaceMatrixBridge();
  return <MainLayout />;
}
```

#### 5.2.3 BindFolderButton, BindFolderConfirmDialog, WorkspaceSection

UI 组件**整体复用上一版**，仅文案微调（强调"文件不上传"）。WorkspaceSection 新增**访问日志**子区块：

```tsx
// packages/ui/src/workspace/AccessLogSection.tsx
import { useEffect, useState } from "react";

export function AccessLogSection({ roomId }: { roomId: string }) {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await window.electron?.workspace.getAccessLog(roomId, 10);
      if (!cancelled) setLogs(data ?? []);
    })();

    const handler = (_e: any, payload: { roomId: string; entry: any }) => {
      if (payload.roomId === roomId) {
        setLogs((prev) => [payload.entry, ...prev].slice(0, 10));
      }
    };
    const unsub = window.electron?.workspace.onAccessLogged?.(handler);

    return () => { cancelled = true; unsub?.(); };
  }, [roomId]);

  if (logs.length === 0) {
    return (
      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        Agent 暂未访问任何文件
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
        最近访问
      </p>
      {logs.slice(0, 5).map((log, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[10px]"
             style={{ color: log.success ? 'var(--text-secondary)' : 'var(--color-danger)' }}>
          <span>{log.type === "read" ? "📖" : "📋"}</span>
          <span className="truncate font-mono">{log.path}</span>
          <span className="ml-auto shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            {formatRelativeTime(log.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}
```

### 5.3 Agent 侧（如何使用此协议）

> 本节不属于 Magic Client 实现范围，但为 Agent 集成方提供参考。

Agent 容器中需要实现的逻辑（伪代码）：

```python
# Agent 的 file-access skill
import uuid
import asyncio
import base64

class WorkspaceFileAccess:
    def __init__(self, matrix_client, room_id, binding_owner):
        self.client = matrix_client
        self.room_id = room_id
        self.binding_owner = binding_owner
        self.pending = {}  # request_id → Future

    async def get_file_tree(self):
        """从房间 state 中读取文件清单"""
        state = await self.client.get_state_event(
            self.room_id, "com.magic.workspace.binding", self.binding_owner
        )
        if not state.get("bound"):
            return None
        if state.get("treeChunked"):
            return await self._fetch_chunked_tree(state["treeManifestEventIds"])
        return state.get("tree", [])

    async def read_file(self, path, max_size=1048576):
        """请求读取文件"""
        request_id = str(uuid.uuid4())
        future = asyncio.Future()
        self.pending[request_id] = future

        await self.client.send_event(self.room_id, "com.magic.workspace.read_request", {
            "request_id": request_id,
            "path": path,
            "max_size": max_size,
            "encoding": "auto",
            "binding_owner": self.binding_owner,
        })

        try:
            response = await asyncio.wait_for(future, timeout=30)
            if not response["ok"]:
                raise FileNotFoundError(response.get("errorMessage"))

            if response.get("via_media"):
                content = await self.client.download_media(response["mxc_url"])
                return content.decode("utf-8") if response["encoding"] == "utf-8" else content
            else:
                if response["encoding"] == "utf-8":
                    return response["content"]
                else:
                    return base64.b64decode(response["content"])
        except asyncio.TimeoutError:
            del self.pending[request_id]
            raise TimeoutError(f"用户客户端 {self.binding_owner} 未在 30 秒内响应")

    async def on_room_event(self, event):
        if event["type"] != "com.magic.workspace.read_response":
            return
        request_id = event["content"].get("request_id")
        if request_id in self.pending:
            self.pending[request_id].set_result(event["content"])
            del self.pending[request_id]


# Agent 工具调用流程示例
async def handle_user_request(user_message):
    workspace = WorkspaceFileAccess(matrix_client, current_room, binding_owner)

    # 1. 看清单
    tree = await workspace.get_file_tree()
    if not tree:
        return "对话中没有绑定文件夹"

    # 2. LLM 决定读哪些文件
    relevant_paths = llm_select_relevant_files(tree, user_message)

    # 3. 按需读取
    file_contents = {}
    for path in relevant_paths:
        try:
            file_contents[path] = await workspace.read_file(path)
        except Exception as e:
            file_contents[path] = f"[读取失败: {e}]"

    # 4. 拼进 Prompt
    prompt = f"""
用户请求：{user_message}

相关文件：
{format_files_for_prompt(file_contents)}

请基于以上文件回答用户的问题。
"""
    return await llm.complete(prompt)
```

⚠️ Agent 集成方需注意：
- read_request 是异步的，需要 timeout 处理（默认 30 秒）
- Magic 客户端可能离线 → Agent 需优雅降级
- 不要无脑请求所有文件，先用文件名/路径让 LLM 决定相关性

---

## 6. 安全性

### 6.1 文件访问控制（关键改进）

由于读取按需进行，安全护栏分布在两层：

**第 1 层：Magic 客户端（最强护栏）**
- 路径越界防护：`resolveSafePath()` 拒绝逃出绑定根的路径（如 `../../etc/passwd`）
- 忽略列表过滤：即使 Agent 请求 `.env`，客户端也拒绝
- 单次读取大小上限：硬编码 10MB
- 仅响应**自己绑定的房间**的请求

**第 2 层：Matrix 协议天然护栏**
- 房间成员鉴权：非房间成员发的事件被 Homeserver 拒绝
- 端到端加密：E2EE 房间中文件内容被 Megolm 加密
- 审计：所有 read_request/response 永久存于房间历史

### 6.2 默认忽略列表（强化）

```
.ssh/**, .aws/**, .gnupg/**, .config/**/credentials*
*.pem, *.key, *.p12, *.pfx, *.jks, *.keystore
id_rsa*, id_ed25519*, id_ecdsa*
.env, .env.*, *.envrc
.npmrc, .pypirc, .gem/credentials
.docker/config.json, .kube/config
```

### 6.3 用户授权与可见性

- 必须用户主动通过原生选择器选择
- 必须勾选"我理解"才能确认
- ChannelHeader 始终显示绑定状态
- WorkspaceSection 显示完整访问日志
- 用户可随时解绑

### 6.4 范围隔离

- 每个房间独立绑定
- 多用户同时绑定时，每个 binding_owner 独立响应
- 解绑后立即停止响应

### 6.5 端到端加密注意事项

E2EE 房间中：
- read_response 中的文件内容被 Megolm 加密 ✅
- 但 state event（文件清单）通常**不加密**（state event 在大多数 Matrix 房间是明文）
- 解决方案：清单只含路径和大小，不暴露文件内容；敏感项目建议绑定到 E2EE 房间且使用 chunked tree（chunk 走 message event 走加密）

---

## 7. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 群聊房间和私聊都能在 + 菜单看到"绑定本地文件夹" | 视觉检查两种场景 |
| AC-2 | 点击后弹出原生文件选择器 | 手动验证 |
| AC-3 | 选择文件夹后显示扫描结果（文件数+大小） | 手动验证 |
| AC-4 | 确认对话框文案明确说明"文件不上传到服务器" | 视觉检查 |
| AC-5 | 私聊场景下警告显示对方具体名字（非"Agent"泛称） | 私聊中绑定验证 |
| AC-6 | 必须勾选"我理解"才能绑定 | 手动验证 |
| AC-7 | 绑定后**立即**完成（无上传等待，秒级） | 手动计时验证 |
| AC-8 | 绑定后房间内出现 `com.magic.workspace.binding` state event | Matrix 客户端工具检查 |
| AC-9 | state event 中包含完整文件清单（< 500 文件场景） | 检查 event content |
| AC-10 | 文件数 > 500 时使用 chunked 模式发清单 | 创建大目录验证 |
| AC-11 | ChannelHeader 显示 📁 文件夹名 + 文件数 | 视觉检查 |
| AC-12 | 群聊和私聊设置面板的"工作区"模块都正常显示 | 两边检查 |
| AC-13 | **Agent 发送 read_request 后，客户端在 1 秒内返回 read_response** ⭐ | 用 Matrix 工具发请求 |
| AC-14 | 读取 < 32KB 文件走内联 content | 检查 response 字段 |
| AC-15 | 读取 > 32KB 文件走 mxc:// 媒体上传 | 检查 response 字段 |
| AC-16 | Agent 请求 `../../etc/passwd` 被拒绝（permission_denied） | 故意发越界请求 |
| AC-17 | Agent 请求 `.env` 被拒绝（permission_denied） | 故意请求敏感文件 |
| AC-18 | 请求超过 max_size 的文件返回 size_exceeded | 验证大文件 |
| AC-19 | 请求不存在的文件返回 file_not_found | 验证 |
| AC-20 | 修改本地文件后 2 秒内重新发布清单 state event | 修改文件验证 |
| AC-21 | WorkspaceSection 显示访问日志（"manager 读取了 src/main.py"） | 触发请求后检查 |
| AC-22 | 访问日志持久化（重启应用后还在） | 重启验证 |
| AC-23 | 解绑时清空 state event（bound: false） | 解绑后检查 |
| AC-24 | 同一文件夹可绑定到多个对话且互不影响 | 绑两个房间验证 |
| AC-25 | 重启应用后绑定关系恢复，文件监听重新启动 | 重启验证 |
| AC-26 | **完全没有任何 HTTP 请求发到 Matrix Homeserver 之外的服务器** ⭐ | 抓包工具验证 |
| AC-27 | `pnpm typecheck && pnpm build` 通过 | 命令验证 |

---

## 8. 实现任务（按执行顺序）

### 任务 1：Electron 主进程基础设施

**创建文件**：
- `apps/desktop/src/main/workspace/IgnoreEngine.ts`
- `apps/desktop/src/main/workspace/WorkspaceManager.ts`（按 §5.1.2 实现）
- `apps/desktop/src/main/ipc/workspace.ts`（按 §5.1.1 实现）

**修改文件**：
- `apps/desktop/src/main/index.ts` — 初始化 WorkspaceManager 并注册 IPC
- 在 `app.on('before-quit')` 中调用 `workspace.shutdown()`

**依赖安装**：
```bash
pnpm add chokidar minimatch -F @magic/desktop
pnpm add -D @types/minimatch -F @magic/desktop
```

⚠️ 与上一版的区别：**没有 SyncEngine、没有 fetch、没有 EventSource**。

**验证**：`pnpm typecheck`

---

### 任务 2：Preload 暴露 workspace API

**修改文件**：`apps/desktop/src/preload/index.ts`

```typescript
contextBridge.exposeInMainWorld("electron", {
  workspace: {
    pickFolder: () => ipcRenderer.invoke("workspace:pickFolder"),
    scanFolder: (p: string) => ipcRenderer.invoke("workspace:scanFolder", p),
    bind: (rid: string, p: string, boundBy: string) =>
      ipcRenderer.invoke("workspace:bind", rid, p, boundBy),
    unbind: (rid: string) => ipcRenderer.invoke("workspace:unbind", rid),
    getBinding: (rid: string) => ipcRenderer.invoke("workspace:getBinding", rid),
    getAllBindings: () => ipcRenderer.invoke("workspace:getAllBindings"),
    revealInFinder: (rid: string) => ipcRenderer.invoke("workspace:revealInFinder", rid),

    // ⭐ 关键新增
    readFile: (rid: string, p: string, maxSize: number, requesterId: string) =>
      ipcRenderer.invoke("workspace:readFile", rid, p, maxSize, requesterId),
    listDir: (rid: string, p: string, depth: number, requesterId: string) =>
      ipcRenderer.invoke("workspace:listDir", rid, p, depth, requesterId),
    getAccessLog: (rid: string, limit: number) =>
      ipcRenderer.invoke("workspace:getAccessLog", rid, limit),

    onBindingChanged: (h: any) => {
      ipcRenderer.on("workspace:binding-changed", h);
      return () => ipcRenderer.removeListener("workspace:binding-changed", h);
    },
    onFileTreeChanged: (h: any) => {
      ipcRenderer.on("workspace:file-tree-changed", h);
      return () => ipcRenderer.removeListener("workspace:file-tree-changed", h);
    },
    onAccessLogged: (h: any) => {
      ipcRenderer.on("workspace:access-logged", h);
      return () => ipcRenderer.removeListener("workspace:access-logged", h);
    },
  },
});
```

更新 `preload/index.d.ts` 类型声明。

**验证**：`pnpm typecheck`

---

### 任务 3：useWorkspaceMatrixBridge Hook（最关键）

**创建文件**：`packages/ui/src/hooks/useWorkspaceMatrixBridge.ts`

按 §5.2.1 实现，包含：
- 监听 main 进程的 file-tree-changed → 发布 state event
- 监听 Matrix Room.timeline 的 read_request/list_request → 调用 main 进程读取 → 发回响应

**验证**：`pnpm typecheck`

---

### 任务 4：在 App 顶层挂载 Bridge

**修改文件**：`apps/desktop/src/renderer/src/App.tsx`

```tsx
import { useWorkspaceMatrixBridge } from "@magic/ui/hooks";

function App() {
  useWorkspaceMatrixBridge();
  return <MainLayout />;
}
```

**验证**：`pnpm typecheck && pnpm dev:desktop`

---

### 任务 5：UI 组件

**创建文件**：
- `packages/ui/src/hooks/useWorkspaceBinding.ts`
- `packages/ui/src/workspace/BindFolderButton.tsx`
- `packages/ui/src/workspace/BindFolderConfirmDialog.tsx`（**强调不上传文案**）
- `packages/ui/src/workspace/WorkspaceSection.tsx`
- `packages/ui/src/workspace/AccessLogSection.tsx`（**新增**）
- `packages/ui/src/workspace/WorkspaceIndicator.tsx`

**验证**：`pnpm typecheck`

---

### 任务 6：集成到 MessageComposer + 按钮菜单

在 + 菜单中加"绑定本地文件夹"。

**验证**：`pnpm typecheck`

---

### 任务 7：集成到 ChannelHeader（群聊 + 私聊）

在房间名旁显示 WorkspaceIndicator，**两种对话场景共用**。

**验证**：`pnpm typecheck`

---

### 任务 8：集成到设置面板（群聊 + 私聊都需要）

**修改文件**：
- `packages/ui/src/settings/RoomSettingsPanel.tsx`
- `packages/ui/src/settings/DMSettingsPanel.tsx`

两边都插入 `<WorkspaceSection roomId={roomId} />`。

**验证**：`pnpm typecheck`

---

### 任务 9：导出 + 全局验证

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm dev:desktop
```

完成后提交：
```bash
git add -A
git commit -m "feat: 022 - workspace folder binding via Matrix protocol (on-demand, zero backend)"
```

---

## 9. v1 vs 后续版本

### v1（本 spec 范围）
- ✅ 用户主动绑定本地文件夹
- ✅ Matrix state event 发布文件清单（含 chunked 模式）
- ✅ 监听 read_request → 按需读取并响应
- ✅ 监听 list_request → 按需列表并响应
- ✅ chokidar 监听本地变化，2 秒防抖后重新发布清单
- ✅ 路径越界 + 忽略列表 + 大小限制三道护栏
- ✅ 访问日志持久化 + UI 展示
- ✅ 大文件走 Matrix media upload
- ✅ 群聊 + 私聊统一支持
- ✅ **零后端依赖**

### v2（未来）
- 写入支持（write_request + 用户审批 UI）
- 客户端离线时的缓存层（Agent 仍能读取最近访问过的文件）
- 文件级权限：用户可勾选哪些子目录"对 Agent 可见"
- E2EE 状态事件（隐藏文件清单不被服务器看到）
- 跨设备同步绑定关系（通过 Matrix account data）

### v3（未来）
- 多文件夹绑定（一个对话多个工作区）
- 增量清单更新（只发送变化的文件而非全量重发）
- 与 Git 集成（Agent 可看到 git status / diff）

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 客户端离线时 Agent 无法访问 | 功能可用性下降 | UI 显示"绑定但客户端离线"，Agent 收到 `owner_offline` 错误后优雅降级 |
| Agent 高频请求大量文件造成本地 IO 压力 | 性能问题 | 单次请求大小硬上限 10MB；后续可加并发限制 |
| 大型 monorepo 文件清单超过 64KB state event 上限 | 清单发布失败 | 自动 chunked 模式（>500 文件） |
| 文件清单变化频繁触发 state event 抖动 | 房间历史污染 | chokidar 防抖 2 秒 |
| 路径越界攻击 | 安全风险 | `resolveSafePath()` 双重校验（normalize + startsWith） |
| Agent 通过文件清单推断用户隐私 | 隐私 | 默认忽略列表 + 用户可自定义 `.magicignore` |
| state event 中文件清单不加密 | 元数据泄露 | 文档明示限制；敏感项目用 chunked 模式（chunk 走加密 message event） |
| 多设备同时绑定同一房间 | 响应冲突 | state event 用 state_key=userId 隔离；read_request 用 binding_owner 字段定向 |
| 应用闪退导致 watcher 未关闭 | 资源泄漏 | `app.on('before-quit')` 调用 `workspace.shutdown()` |

---

## 11. 与上一版 spec 的对照（重要变更摘要）

| 项目 | 上一版（已废弃） | 本版 |
|------|-----------------|------|
| 后端依赖 | Magic 后端 + MinIO | **无** |
| HTTP API | `PUT/GET/DELETE /workspace/...` | **无** |
| 数据流 | 上传到 MinIO → Agent 容器挂载 | Matrix 协议按需请求-响应 |
| 文件存储 | 本地 + MinIO 双副本 | **仅本地** |
| 网络流量 | 绑定时全量上传 | 仅传输 Agent 实际请求的文件 |
| 同步引擎 | SyncEngine（uploadFolder/uploadFile） | **删除** |
| 远程变更监听 | SSE / WebSocket | **删除** |
| 离线访问 | ✅ Agent 可访问已同步文件 | ❌ 客户端必须在线 |
| 隐私 | 文件长期驻留服务端 | 文件从未离开本地 |
| 实施复杂度 | 需后端配合 + 部署 MinIO | 仅前端 + Matrix 协议 |
| 预估工时 | 5-7 天（不含后端） | **4-5 天** |