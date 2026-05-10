# Spec 022: 对话本地文件夹绑定（v3 — Matrix 原生附件版）

> 优先级: P0 | 波次: Wave 6 | 预估: 4-5 天 | 前置依赖: 003-electron-shell, 005-room-list, 020-ui-polish, 021-room-settings
> 文件路径: `specs/022-workspace-binding/spec.md`

---

## 0. 设计演进史（必读）

| 版本 | 思路 | 为什么不行 |
|------|------|-----------|
| **v1** | 上传所有文件到 Magic 后端 + MinIO，Agent 容器挂载 | 需要独立后端服务，重 |
| **v2** | 自定义 Matrix 协议（`com.magic.workspace.read_request/response`） | **致命缺陷**：Agent 不会实现这个协议。它就是个普通 Matrix bot，没有内置代码处理这种事件，prompt 里写指令也没用——LLM 没有"发送任意 Matrix 事件"的工具 |
| **v3（本版）** | **Magic Client 主动推送文件**：用 Matrix 原生 `m.file` 附件 / 内联代码块，把文件内容塞进对话 | ✅ 任何 Matrix Agent 都能看到附件和聊天文字，无需任何特殊协议 |

### 桥接方向（v2 vs v3）

```
v2（错）：等 Agent 来请求 → Agent 根本不会请求
                                    ↓
                               永远不工作

v3（对）：用户消息提到文件 → Magic Client 主动读本地文件 → 用 Matrix 标准消息塞进对话
                                                            ↓
                                                Agent 自然看到，无需任何配合
```

---

## 1. 目标

为 Magic 客户端的**所有对话场景**（群聊房间 + 与 Agent 私聊）增加**本地文件夹绑定**能力，类似 Claude Cowork 的 "Choose a folder" 功能。

### 关键原则

1. **零后端依赖** —— 只用 Matrix 原生协议
2. **零 Agent 侧改造** —— 不要求 Agent 实现任何自定义协议；Agent 只需要能读普通 Matrix 消息和附件即可
3. **Magic Client 是主动桥接者** —— 不等待 Agent 请求，而是基于用户的输入和操作主动把文件推送到对话中
4. **隐私可控** —— 文件只在用户明确触发时才进入对话；可在设置中关闭自动附加

### 用户故事

- **私聊场景（核心）**：作为开发者，我把本地代码仓库绑定到与 Worker Agent 的私聊。我说"看看 `src/main.py` 写得怎么样"——Magic Client 自动把 main.py 内容附加到我的消息里，Agent 看到代码并给出建议。
- **显式选择**：我点击工作区按钮，从树中勾选 3 个文件，然后输入"对比这几个的设计差异"——3 个文件作为附件随消息发出。
- **群聊场景**：在房间绑定需求文档文件夹，多个 Agent 都能看到我每次提到的文档内容。
- **管理场景**：我可以在设置中查看绑定状态、关闭自动附加、解绑文件夹。

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Magic Desktop (Electron)                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Main Process                                         │  │
│  │  ├── FolderPicker (dialog.showOpenDialog)             │  │
│  │  ├── WorkspaceRegistry (per-room binding store)       │  │
│  │  ├── FileWatcher (chokidar — 仅用于刷新清单)          │  │
│  │  ├── IgnoreEngine (.magicignore + defaults)           │  │
│  │  └── FileReader (按需读取本地文件供 renderer 使用)    │  │
│  └────────────────────┬──────────────────────────────────┘  │
│                       │ IPC                                  │
│  ┌────────────────────▼──────────────────────────────────┐  │
│  │  Renderer Process（核心桥接逻辑都在这里）              │  │
│  │  ├── BindFolderButton (in MessageComposer +)          │  │
│  │  ├── WorkspaceFilePicker (📁 按钮 → 文件树选择)        │  │
│  │  ├── MessageInterceptor ⭐                             │  │
│  │  │     └── 拦截用户消息发送                            │  │
│  │  │         检测文件路径引用                            │  │
│  │  │         读取本地文件                                │  │
│  │  │         以 Matrix 原生方式附加到对话                │  │
│  │  └── Matrix client (matrix-js-sdk)                    │  │
│  │      ├── sendEvent(m.text) — 普通文字 + 内联代码块    │  │
│  │      ├── uploadContent + sendEvent(m.file) — 大文件   │  │
│  │      └── sendStateEvent — 仅用于同步绑定状态           │  │
│  └────────────────────┬──────────────────────────────────┘  │
└────────────────────────┼─────────────────────────────────────┘
                         │ Matrix 协议（仅原生事件）
       ┌─────────────────▼──────────────────┐
       │      Matrix Homeserver (Tuwunel)   │
       │  - 房间事件流转                     │
       │  - Media repo 存附件                │
       │  - 加密（E2EE 房间附件加密）        │
       └─────────────────┬──────────────────┘
                         │
       ┌─────────────────▼──────────────────┐
       │      Agent (任意 Matrix bot)        │
       │  - 收到普通 m.text / m.file 消息    │
       │  - 像看任何聊天消息一样看           │
       │  - 文件附件走标准 mxc:// 下载       │
       │  - 无需实现任何自定义协议 ⭐         │
       └────────────────────────────────────┘
```

### 2.2 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| **文件传输形式** | Matrix 原生 m.file / m.text 内联 | 任何 Matrix client / bot 都能处理 |
| **小文件（<50KB 文本）** | 内联代码块到用户消息正文 | LLM 直接看到，无需下载附件 |
| **大文件 / 二进制** | 上传到 Matrix media repo，发 m.file 消息 | 标准方式，附件可加密 |
| **文件检测方式** | 1. 用户显式选择 + 2. 消息中识别文件路径 | 显式优先，自动作为补充 |
| **绑定状态广播** | state event + 一条文字通告 | UI 一致性 + Agent 知情 |
| **自定义 Matrix 事件类型** | **不使用** | v2 教训：Agent 不会实现 |

### 2.3 路径与命名空间

| 层级 | 表示 |
|------|------|
| 用户本地（绝对路径） | `/Users/jacefu/TestMagic/src/main.py` |
| Magic Client 内部 | `src/main.py`（相对路径） |
| Matrix 消息中显示给 Agent | `src/main.py`（不含用户用户名等隐私） |

⚠️ 用户的绝对路径（如 `/Users/jacefu`）**永不出现在 Matrix 协议层**，仅本地存储中可见。

---

## 3. UI/UX 设计

### 3.1 入口位置

**主入口：MessageComposer 的 + 按钮菜单**

```
[+] → 弹出菜单：
       📎 上传文件                  ← 临时上传任意文件
       📁 绑定本地文件夹             ← 一次性绑定，长期使用
       🖼  插入图片
```

**辅助入口：MessageComposer 工具栏的 📁 按钮**

绑定后，MessageComposer 工具栏多一个按钮：

```
┌──────────────────────────────────────────────┐
│ [+]  [📁]  [🙂]                              │
│                                              │
│      输入消息…                                │
│                                              │
└──────────────────────────────────────────────┘
```

📁 按钮点击 → 弹出**WorkspaceFilePicker**，从 workspace 文件树中勾选文件。
勾选的文件以 chip 形式显示在输入框上方：

```
┌──────────────────────────────────────────────┐
│ 已附加：                                      │
│ [📄 src/main.py] [📄 src/auth.py] [✕ 清空]   │
│                                              │
│ [+]  [📁³]  [🙂]                             │
│                                              │
│      看看这两个文件的设计                       │
└──────────────────────────────────────────────┘
```

发送时，附加的文件会随消息一起发出。

**辅助入口：ChannelHeader 状态指示器**

群聊和私聊都显示：

```
群聊：# room-name                     📁 TestMagic · 142 files  [⚙]
私聊：@ manager 💕                    📁 TestMagic · 142 files  [⚙]
```

**管理入口：设置面板的"工作区"模块**

群聊 RoomSettingsPanel + 私聊 DMSettingsPanel 都有，可解绑、查看清单、切换自动附加开关。

### 3.2 绑定流程

```
1. 用户点击 [+] → 选择"绑定本地文件夹"
2. 弹出原生文件选择对话框
3. 用户选择 /Users/jacefu/TestMagic
4. 弹出确认对话框：

   ┌──────────────────────────────────────────┐
   │ 绑定本地文件夹到此对话？                  │
   ├──────────────────────────────────────────┤
   │ 📁 TestMagic                             │
   │ /Users/jacefu/TestMagic                  │
   │                                          │
   │ 扫描到 142 个文件 (2.4 MB)               │
   │ 已自动忽略：node_modules, .git, .env     │
   │                                          │
   │ 工作方式：                                │
   │ ✓ 文件保留在你的电脑上                    │
   │ ✓ 当你的消息提到文件路径时，Magic 自动把  │
   │   文件内容附到消息中发给 Agent             │
   │ ✓ 你也可以点 📁 按钮显式选择文件          │
   │ ✓ 自动附加可在设置中关闭                  │
   │                                          │
   │ ☐ 我理解上述说明                          │
   │                                          │
   │            [取消]  [绑定]                  │
   └──────────────────────────────────────────┘

5. 用户确认 → Magic Client 扫描文件夹
6. ⭐ 发送绑定通告消息（普通聊天消息）：

   消息内容：
   ┌──────────────────────────────────────────┐
   │ 📁 已绑定本地工作区：TestMagic            │
   │                                          │
   │ 包含 142 个文件（2.4 MB）                 │
   │                                          │
   │ 文件清单：                                │
   │ - README.md                              │
   │ - package.json                           │
   │ - src/main.py                            │
   │ - src/auth.py                            │
   │ - src/utils.py                           │
   │ - tests/test_main.py                     │
   │ - ... 还有 N 个文件                       │
   │                                          │
   │ 接下来当我提到文件路径（如 src/main.py） │
   │ 时，文件内容会自动附加到我的消息中。     │
   │ 你可以基于实际文件内容回答我的问题。      │
   └──────────────────────────────────────────┘

   如果文件清单超过 100 个，则附带一个 m.file 附件
   workspace-manifest.txt 包含完整清单。

7. ChannelHeader 显示 📁 状态指示
8. MessageComposer 工具栏出现 📁 按钮
```

### 3.3 智能附加流程（核心）

用户在已绑定房间发消息：

```
用户输入：
  "看看 src/main.py 这个文件设计上有什么问题？"

Magic Client 拦截发送：
  1. 提取文本中的 token
  2. 与 workspace 文件树匹配：
     - 完整路径匹配："src/main.py" ✅
  3. 读取本地文件 /Users/jacefu/TestMagic/src/main.py
  4. 决定附加方式：
     - 文件大小：3.2 KB（< 50KB 阈值）
     - 类型：文本
     - → 内联到消息正文

实际发送的消息（普通 m.text）：
  ┌──────────────────────────────────────────┐
  │ 看看 src/main.py 这个文件设计上有什么问题？│
  │                                          │
  │ ────────                                 │
  │ 📎 src/main.py                           │
  │ ```python                                │
  │ from flask import Flask                  │
  │ app = Flask(__name__)                    │
  │                                          │
  │ @app.route("/")                          │
  │ def index():                             │
  │   ...                                    │
  │ ```                                      │
  └──────────────────────────────────────────┘

UI 渲染（用户视角）：
  普通消息气泡，附带文件 chip：
  ┌──────────────────────────────────────────┐
  │ 看看 src/main.py 这个文件设计上有什么问题？│
  │                                          │
  │ [📄 src/main.py · 3.2 KB]                │
  └──────────────────────────────────────────┘

  （展开 chip 可查看完整内容）

Agent 视角：
  收到带代码块的消息，直接基于代码回答
```

### 3.4 显式选择流程

```
1. 用户点击 MessageComposer 工具栏的 📁 按钮
2. 弹出 WorkspaceFilePicker：

   ┌──────────────────────────────────────────┐
   │ 选择要附加的文件                          │
   │ ────────                                 │
   │ ☐ README.md                              │
   │ ☐ package.json                           │
   │ ▼ src/                                   │
   │   ☑ main.py (3.2 KB)                    │
   │   ☑ auth.py (1.8 KB)                    │
   │   ☐ utils.py                             │
   │ ▼ tests/                                 │
   │   ☐ test_main.py                         │
   │ ────────                                 │
   │ 已选 2 个文件 (5.0 KB)                   │
   │                                          │
   │      [取消]  [附加到下一条消息]            │
   └──────────────────────────────────────────┘

3. 用户勾选 → 点确认
4. MessageComposer 输入框上方出现 chip：
   [📄 src/main.py] [📄 src/auth.py] [✕ 清空]
5. 用户输入文字 → 发送
6. 文件随消息一起发出（同 §3.3 的内联或附件方式）
```

### 3.5 大文件 / 二进制文件处理

```
用户输入："看看 docs/diagram.png 这个图"

Magic Client 检测：
  - 文件类型：image/png
  - 大小：800 KB
  - → 走 Matrix media upload，发独立 m.image 消息

Magic Client 实际发送 2 条消息：
  消息 1（m.text）：
    "看看 docs/diagram.png 这个图"

  消息 2（m.image）：
    {
      "msgtype": "m.image",
      "body": "diagram.png",
      "info": { ... },
      "url": "mxc://matrix.example.com/abc123",
      "com.magic.workspace.attachment": {
        "originalPath": "docs/diagram.png",
        "fromWorkspace": "TestMagic"
      }
    }

Agent 视角：
  看到文字 + 图片附件，按其能力处理
  （视觉模型可分析图片；纯文本模型可读取 alt text/文件名）
```

### 3.6 自动附加的开关

设置面板的"工作区"模块中：

```
工作区
├─ 已绑定: TestMagic
├─ 同步状态: ✅
├─ ⚙ 自动附加: [✓ 开启]
│   说明：当我的消息提到 workspace 中的文件路径时，
│        自动读取并附加文件内容到消息。
├─ ⚙ 单文件大小上限: [50 KB]（超过转为附件）
├─ [打开本地文件夹]
└─ [解除绑定]
```

关闭自动附加后，仅 📁 按钮的显式选择生效。

---

## 4. 文件检测算法

智能附加的核心是**从用户消息文本中识别 workspace 文件引用**。

### 4.1 检测策略（优先级从高到低）

#### 4.1.1 反引号包裹的路径

```
正则: /`([^`]+)`/g
示例：
  "看看 `src/main.py`" → 提取 "src/main.py"
  "对比 `a.py` 和 `b.py`" → 提取两个
检查：提取的字符串如果完全匹配 workspace 文件树中的某条路径 → 附加
```

#### 4.1.2 显式 @file 语法

```
正则: /@file:([^\s]+)/g
示例：
  "看看 @file:src/main.py" → 提取 "src/main.py"
  这是给"知道这个语法"的高级用户用的，类似 GitHub 的 #issue 引用
```

#### 4.1.3 完整路径直接出现

```
检查每个 token 是否包含 / 或 \
示例：
  "src/main.py 怎么样？" → 提取 "src/main.py"
  "看看 tests/test_auth.py" → 提取 "tests/test_auth.py"
检查：是否是 workspace 树中的有效路径 → 附加
```

#### 4.1.4 唯一文件名匹配

```
对于不带路径的文件名（如 "main.py"）：
- 检查 workspace 树中有几个文件名匹配
- 如果只有 1 个 → 附加
- 如果有多个 → 不附加（避免歧义），UI 提示用户使用完整路径
- 如果是常见文件（README.md, package.json, Cargo.toml 等）→ 附加根目录的那个
示例：
  "看看 main.py" → 如果只有 src/main.py → 附加
  "看看 main.py" → 如果有 src/main.py 和 tests/main.py → 不附加，提示
  "看看 README.md" → 总是附加根目录的 README.md
```

### 4.2 不附加的情况

- 路径不在 workspace 中（如用户写 `/etc/passwd`）
- 文件被 .magicignore 排除
- 文件 > 5 MB（提示用户大文件需用显式选择）
- 用户在设置中关闭了自动附加

### 4.3 上限保护

- 单条消息最多自动附加 5 个文件（防止用户写"看看所有 .py 文件"导致全量附加）
- 超过则附加前 5 个并提示："已附加前 5 个文件，如需更多请使用 📁 按钮"
- 自动附加的总大小不超过 1 MB（防止把消息撑爆）

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

  ipcMain.handle("workspace:bind", async (_e, roomId: string, folderPath: string, boundBy: string) =>
    workspace.bind(roomId, folderPath, boundBy)
  );

  ipcMain.handle("workspace:unbind", async (_e, roomId: string) =>
    workspace.unbind(roomId)
  );

  ipcMain.handle("workspace:getBinding", async (_e, roomId: string) =>
    workspace.getBinding(roomId)
  );

  ipcMain.handle("workspace:getFileTree", async (_e, roomId: string) =>
    workspace.getFileTree(roomId)
  );

  ipcMain.handle("workspace:revealInFinder", async (_e, roomId: string) =>
    workspace.revealInFinder(roomId)
  );

  // ⭐ 核心接口：renderer 在发送消息时调用，读取本地文件
  ipcMain.handle("workspace:readFile",
    async (_e, roomId: string, relPath: string) =>
      workspace.readFile(roomId, relPath)
  );

  // ⭐ 偏好设置：自动附加开关
  ipcMain.handle("workspace:setAutoAttach",
    async (_e, roomId: string, enabled: boolean) =>
      workspace.setAutoAttach(roomId, enabled)
  );

  ipcMain.handle("workspace:getAutoAttach",
    async (_e, roomId: string) => workspace.getAutoAttach(roomId)
  );
}
```

#### 5.1.2 WorkspaceManager（简化版）

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
  autoAttach: boolean;          // ⭐ 自动附加开关
}

interface FileEntry {
  path: string;
  size: number;
  mtime: number;
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
  private fileTrees: Map<string, FileEntry[]> = new Map();
  private watchers: Map<string, FSWatcher> = new Map();
  private storageFile: string;
  private onBindingChanged: (roomId: string, binding: Binding | null, files: FileEntry[]) => void;

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

  // 单文件读取上限：10 MB（renderer 侧会更保守，5 MB 就拒绝自动附加）
  private readonly MAX_READ_SIZE = 10 * 1024 * 1024;

  // 总文件数硬上限
  private readonly MAX_FILE_COUNT = 10000;

  // 文件夹元数据扫描上限
  private readonly MAX_TOTAL_SIZE = 5 * 1024 * 1024 * 1024;

  constructor(onBindingChanged: (roomId: string, binding: Binding | null, files: FileEntry[]) => void) {
    this.storageFile = path.join(app.getPath("userData"), "workspaces.json");
    this.onBindingChanged = onBindingChanged;
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

    // 恢复文件监听 + 重新扫描文件树
    for (const [roomId, binding] of this.bindings.entries()) {
      try {
        await fs.access(binding.localPath);
        const scan = await this.scanFolder(binding.localPath);
        this.fileTrees.set(roomId, scan.files);
        await this.startWatching(roomId, binding);
      } catch {
        console.warn(`绑定路径不存在: ${binding.localPath}`);
      }
    }
  }

  private async save(): Promise<void> {
    const data = {
      version: 3,  // v3 标记
      bindings: Object.fromEntries(this.bindings.entries()),
    };
    await fs.writeFile(this.storageFile, JSON.stringify(data, null, 2));
  }

  /**
   * 扫描文件夹，返回文件清单（仅元数据）
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
            files.push({ path: relPath, size: stat.size, mtime: stat.mtimeMs });
            totalSize += stat.size;

            if (files.length >= this.MAX_FILE_COUNT) { truncated = true; break; }
            if (totalSize >= this.MAX_TOTAL_SIZE) { truncated = true; break; }
          } catch {}
        }
      }
    };

    await walk(folderPath);

    return { fileCount: files.length, totalSize, ignoredCount, files, truncated };
  }

  /**
   * 绑定文件夹
   */
  async bind(roomId: string, folderPath: string, boundBy: string): Promise<{ binding: Binding; files: FileEntry[] }> {
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
      autoAttach: true,  // 默认开启自动附加
    };

    this.bindings.set(roomId, binding);
    this.fileTrees.set(roomId, scan.files);
    await this.save();

    // 通知 renderer 发送绑定通告消息（带文件清单）
    this.onBindingChanged(roomId, binding, scan.files);

    await this.startWatching(roomId, binding);

    return { binding, files: scan.files };
  }

  async unbind(roomId: string): Promise<void> {
    const watcher = this.watchers.get(roomId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(roomId);
    }
    this.bindings.delete(roomId);
    this.fileTrees.delete(roomId);
    await this.save();
    this.onBindingChanged(roomId, null, []);
  }

  getBinding(roomId: string): Binding | null {
    return this.bindings.get(roomId) ?? null;
  }

  getFileTree(roomId: string): FileEntry[] {
    return this.fileTrees.get(roomId) ?? [];
  }

  revealInFinder(roomId: string): void {
    const binding = this.bindings.get(roomId);
    if (binding) shell.openPath(binding.localPath);
  }

  /**
   * ⭐ 读取文件（renderer 在拦截消息发送时调用）
   */
  async readFile(roomId: string, relPath: string): Promise<{
    ok: boolean;
    content?: Buffer;
    encoding?: "utf-8" | "base64";
    size?: number;
    mtime?: number;
    isText?: boolean;
    error?: string;
  }> {
    const binding = this.bindings.get(roomId);
    if (!binding) return { ok: false, error: "未绑定" };

    const safe = this.resolveSafePath(binding.localPath, relPath);
    if (!safe) return { ok: false, error: "路径越界" };

    const ignore = new IgnoreEngine(binding.ignorePatterns);
    if (ignore.matches(relPath)) return { ok: false, error: "文件被忽略列表排除" };

    try {
      const stat = await fs.stat(safe);
      if (!stat.isFile()) return { ok: false, error: "不是文件" };
      if (stat.size > this.MAX_READ_SIZE) {
        return { ok: false, error: `文件过大（${stat.size} 字节）` };
      }

      const content = await fs.readFile(safe);
      const isText = this.detectIsText(content);

      return {
        ok: true,
        content,
        encoding: isText ? "utf-8" : "base64",
        size: content.length,
        mtime: stat.mtimeMs,
        isText,
      };
    } catch (err: any) {
      return { ok: false, error: err.code === "ENOENT" ? "文件不存在" : err.message };
    }
  }

  setAutoAttach(roomId: string, enabled: boolean): void {
    const b = this.bindings.get(roomId);
    if (b) {
      b.autoAttach = enabled;
      this.save();
    }
  }

  getAutoAttach(roomId: string): boolean {
    return this.bindings.get(roomId)?.autoAttach ?? false;
  }

  private resolveSafePath(rootPath: string, relPath: string): string | null {
    const normalized = path.normalize(relPath).replace(/^[/\\]+/, "");
    const resolved = path.resolve(rootPath, normalized);
    if (!resolved.startsWith(rootPath + path.sep) && resolved !== rootPath) return null;
    return resolved;
  }

  private detectIsText(content: Buffer): boolean {
    const sample = content.slice(0, 8192);
    if (sample.includes(0)) return false; // 含 NULL 字节 → 二进制
    try {
      const decoded = sample.toString("utf-8");
      const replacementCount = (decoded.match(/\uFFFD/g) || []).length;
      return replacementCount <= sample.length * 0.01;
    } catch {
      return false;
    }
  }

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
    const triggerRescan = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const scan = await this.scanFolder(binding.localPath);
        binding.fileCount = scan.fileCount;
        binding.totalSize = scan.totalSize;
        this.fileTrees.set(roomId, scan.files);
        await this.save();
        // 注意：v3 不在每次文件变化时发新的 Matrix 消息，只更新本地树
        // 仅在用户主动操作时才发消息
        this.notifyTreeChanged(roomId);
      }, 2000);
    };

    watcher.on("add", triggerRescan);
    watcher.on("change", triggerRescan);
    watcher.on("unlink", triggerRescan);

    this.watchers.set(roomId, watcher);
  }

  private notifyTreeChanged(roomId: string): void {
    const binding = this.bindings.get(roomId);
    const files = this.fileTrees.get(roomId) ?? [];
    BrowserWindow.getAllWindows().forEach((win) =>
      win.webContents.send("workspace:tree-changed", { roomId, binding, files })
    );
  }

  async shutdown(): Promise<void> {
    for (const w of this.watchers.values()) await w.close();
    this.watchers.clear();
  }
}
```

#### 5.1.3 IgnoreEngine

沿用前版 minimatch 实现。

### 5.2 Renderer 端 — 核心拦截器

#### 5.2.1 useMessageInterceptor — 消息发送拦截器

```typescript
// packages/ui/src/hooks/useMessageInterceptor.ts
import { useCallback } from "react";
import { getClient } from "@magic/matrix-client";

interface FileEntry {
  path: string;
  size: number;
  mtime: number;
}

interface SendOptions {
  roomId: string;
  text: string;
  explicitAttachments?: string[];  // 用户通过 📁 按钮显式选择的文件
}

/**
 * 消息发送拦截器 — 自动附加 workspace 文件
 *
 * 调用流程：
 * 1. 用户在 MessageComposer 输入文字
 * 2. 检测到文件路径引用 → 读取本地文件
 * 3. 决定附加方式（内联代码块 / m.file 附件）
 * 4. 发送最终消息
 */
export function useMessageInterceptor() {
  const sendWithWorkspace = useCallback(async ({ roomId, text, explicitAttachments = [] }: SendOptions) => {
    const client = getClient();
    if (!client) throw new Error("Matrix client 未初始化");

    // 1. 获取 workspace 状态
    const binding = await window.electron?.workspace.getBinding(roomId);
    if (!binding) {
      // 没有绑定，直接发普通消息
      return await client.sendTextMessage(roomId, text);
    }

    const fileTree: FileEntry[] = await window.electron!.workspace.getFileTree(roomId);
    const autoAttach = binding.autoAttach;

    // 2. 收集要附加的文件路径
    const detectedPaths = autoAttach ? detectFilePaths(text, fileTree) : [];
    const allPaths = [...new Set([...detectedPaths, ...explicitAttachments])];

    // 上限：5 个文件 / 1 MB
    const limited = limitAttachments(allPaths, fileTree, 5, 1024 * 1024);

    if (limited.length === 0) {
      // 无附件，直接发
      return await client.sendTextMessage(roomId, text);
    }

    // 3. 读取每个文件
    const attachments = await Promise.all(
      limited.map(async (relPath) => {
        const result = await window.electron!.workspace.readFile(roomId, relPath);
        return { path: relPath, ...result };
      })
    );

    const validAttachments = attachments.filter(a => a.ok);

    // 4. 分类：内联 vs 独立附件
    const SMALL_TEXT_THRESHOLD = 50 * 1024; // 50 KB
    const inlineable = validAttachments.filter(a =>
      a.isText && (a.size ?? 0) <= SMALL_TEXT_THRESHOLD
    );
    const standalone = validAttachments.filter(a =>
      !a.isText || (a.size ?? 0) > SMALL_TEXT_THRESHOLD
    );

    // 5. 构造主消息（用户文字 + 内联代码块）
    let mainBody = text;
    if (inlineable.length > 0) {
      mainBody += "\n\n────────";
      for (const att of inlineable) {
        const lang = guessLanguage(att.path);
        const content = (att.content as Buffer).toString("utf-8");
        mainBody += `\n\n📎 \`${att.path}\`\n\`\`\`${lang}\n${content}\n\`\`\``;
      }
    }

    // 标记此消息含 workspace 附件（供 UI 渲染 chip）
    const eventContent: any = {
      msgtype: "m.text",
      body: mainBody,
    };
    if (inlineable.length > 0 || standalone.length > 0) {
      eventContent["com.magic.workspace.attached"] = {
        workspaceName: binding.displayName,
        files: [...inlineable, ...standalone].map(a => ({
          path: a.path,
          size: a.size,
          inlined: inlineable.includes(a),
        })),
      };
    }

    const result = await client.sendEvent(roomId, "m.room.message", eventContent);

    // 6. 发独立附件消息
    for (const att of standalone) {
      const blob = new Blob([att.content as Buffer]);
      const filename = att.path.split("/").pop() ?? "file";
      const mimeType = att.isText ? "text/plain" : guessMimeType(att.path);

      const upload = await client.uploadContent(blob, {
        type: mimeType,
        name: filename,
      });

      await client.sendEvent(roomId, "m.room.message", {
        msgtype: att.isText ? "m.file" : (mimeType.startsWith("image/") ? "m.image" : "m.file"),
        body: filename,
        info: {
          size: att.size,
          mimetype: mimeType,
        },
        url: upload.content_uri,
        "com.magic.workspace.attachment": {
          originalPath: att.path,
          fromWorkspace: binding.displayName,
        },
      });
    }

    return result;
  }, []);

  return { sendWithWorkspace };
}

/**
 * 从消息文本中检测 workspace 文件路径引用
 */
function detectFilePaths(text: string, fileTree: FileEntry[]): string[] {
  const paths = new Set<string>();
  const treePathSet = new Set(fileTree.map(f => f.path));
  const fileNameToPaths = new Map<string, string[]>();
  for (const f of fileTree) {
    const baseName = f.path.split("/").pop() ?? "";
    if (!fileNameToPaths.has(baseName)) fileNameToPaths.set(baseName, []);
    fileNameToPaths.get(baseName)!.push(f.path);
  }

  // 策略 1: 反引号包裹的路径
  const backtickRegex = /`([^`\n]+)`/g;
  let match;
  while ((match = backtickRegex.exec(text)) !== null) {
    const candidate = match[1].trim();
    if (treePathSet.has(candidate)) {
      paths.add(candidate);
    } else {
      // 如果是裸文件名，且只有一个匹配
      const matches = fileNameToPaths.get(candidate);
      if (matches && matches.length === 1) paths.add(matches[0]);
    }
  }

  // 策略 2: @file: 语法
  const atFileRegex = /@file:([^\s]+)/g;
  while ((match = atFileRegex.exec(text)) !== null) {
    const candidate = match[1].trim().replace(/[.,;]$/, "");
    if (treePathSet.has(candidate)) paths.add(candidate);
  }

  // 策略 3: 包含 / 的 token
  const tokens = text.split(/[\s，。！？,!?]+/);
  for (const tok of tokens) {
    const cleaned = tok.replace(/[.,;:!?，。；：！？)】」』"']+$/, "")
                       .replace(/^[(【「『"']+/, "");
    if (cleaned.includes("/") && treePathSet.has(cleaned)) {
      paths.add(cleaned);
    }
  }

  // 策略 4: 唯一文件名匹配（裸文件名）
  for (const tok of tokens) {
    const cleaned = tok.replace(/[.,;:!?，。；：！？)】」』"']+$/, "")
                       .replace(/^[(【「『"']+/, "");
    const matches = fileNameToPaths.get(cleaned);
    if (matches && matches.length === 1) {
      paths.add(matches[0]);
    }
    // 常见根目录文件
    if (["README.md", "package.json", "Cargo.toml", "go.mod", "pom.xml"].includes(cleaned)) {
      if (treePathSet.has(cleaned)) paths.add(cleaned);
    }
  }

  return Array.from(paths);
}

function limitAttachments(paths: string[], tree: FileEntry[], maxCount: number, maxTotalSize: number): string[] {
  const treeMap = new Map(tree.map(f => [f.path, f]));
  const result: string[] = [];
  let totalSize = 0;
  for (const p of paths) {
    if (result.length >= maxCount) break;
    const entry = treeMap.get(p);
    if (!entry) continue;
    if (entry.size > 5 * 1024 * 1024) continue; // 跳过 > 5MB 的文件
    if (totalSize + entry.size > maxTotalSize) break;
    result.push(p);
    totalSize += entry.size;
  }
  return result;
}

function guessLanguage(filepath: string): string {
  const ext = filepath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    "py": "python", "js": "javascript", "ts": "typescript",
    "tsx": "tsx", "jsx": "jsx", "rs": "rust", "go": "go",
    "java": "java", "c": "c", "cpp": "cpp", "h": "c", "hpp": "cpp",
    "rb": "ruby", "php": "php", "swift": "swift", "kt": "kotlin",
    "sh": "bash", "yaml": "yaml", "yml": "yaml", "json": "json",
    "md": "markdown", "html": "html", "css": "css", "scss": "scss",
    "sql": "sql", "toml": "toml", "xml": "xml",
  };
  return map[ext] ?? "";
}

function guessMimeType(filepath: string): string {
  const ext = filepath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "gif": "image/gif", "webp": "image/webp", "svg": "image/svg+xml",
    "pdf": "application/pdf", "zip": "application/zip",
  };
  return map[ext] ?? "application/octet-stream";
}
```

#### 5.2.2 useWorkspaceBinding — 状态 Hook

```typescript
// packages/ui/src/hooks/useWorkspaceBinding.ts
import { useState, useEffect, useCallback } from "react";
import { getClient } from "@magic/matrix-client";

export function useWorkspaceBinding(roomId: string) {
  const [binding, setBinding] = useState<any>(null);
  const [fileTree, setFileTree] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const b = await window.electron?.workspace.getBinding(roomId);
      const t = await window.electron?.workspace.getFileTree(roomId);
      if (!cancelled) {
        setBinding(b);
        setFileTree(t ?? []);
        setIsLoading(false);
      }
    })();

    const handler = (_e: any, payload: { roomId: string; binding: any; files: any[] }) => {
      if (payload.roomId === roomId) {
        setBinding(payload.binding);
        setFileTree(payload.files);
      }
    };
    const unsub = window.electron?.workspace.onTreeChanged?.(handler);

    return () => { cancelled = true; unsub?.(); };
  }, [roomId]);

  const unbind = useCallback(async () => {
    await window.electron?.workspace.unbind(roomId);
  }, [roomId]);

  const setAutoAttach = useCallback(async (enabled: boolean) => {
    await window.electron?.workspace.setAutoAttach(roomId, enabled);
    const b = await window.electron?.workspace.getBinding(roomId);
    setBinding(b);
  }, [roomId]);

  return { binding, fileTree, isLoading, unbind, setAutoAttach };
}
```

#### 5.2.3 绑定时发送通告消息

绑定操作流程：

```typescript
// 在 BindFolderConfirmDialog 的 handleBind 中
const handleBind = async () => {
  // ... 调用 main 进程绑定
  const { binding, files } = await window.electron!.workspace.bind(roomId, folderPath, userId);

  // ⭐ 发送绑定通告消息（普通 m.text，让 Agent 看到）
  const client = getClient();
  const treePreview = files.slice(0, 50).map(f => `- ${f.path}`).join("\n");
  const remaining = files.length > 50 ? `\n- ... 还有 ${files.length - 50} 个文件` : "";

  const announceBody = `📁 已绑定本地工作区：${binding.displayName}

包含 ${binding.fileCount} 个文件（${formatSize(binding.totalSize)}）

文件清单：
${treePreview}${remaining}

接下来当我提到文件路径（如 \`src/main.py\`）时，文件内容会自动附加到我的消息中。你可以基于实际文件内容回答我的问题。

如果需要查看完整文件清单，可以告诉我。`;

  await client.sendEvent(roomId, "m.room.message", {
    msgtype: "m.text",
    body: announceBody,
    "com.magic.workspace.notification": {
      kind: "bound",
      displayName: binding.displayName,
      fileCount: binding.fileCount,
    },
  });

  // 如果文件超过 100 个，附加完整清单文件
  if (files.length > 100) {
    const manifestText = files.map(f =>
      `${f.path} (${f.size} bytes)`
    ).join("\n");
    const blob = new Blob([manifestText], { type: "text/plain" });
    const upload = await client.uploadContent(blob, {
      type: "text/plain",
      name: "workspace-manifest.txt",
    });
    await client.sendEvent(roomId, "m.room.message", {
      msgtype: "m.file",
      body: "workspace-manifest.txt",
      info: { size: manifestText.length, mimetype: "text/plain" },
      url: upload.content_uri,
      "com.magic.workspace.attachment": {
        originalPath: "(manifest)",
        fromWorkspace: binding.displayName,
      },
    });
  }

  // 同时发送 state event 通告绑定状态（用于多设备同步）
  await client.sendStateEvent(
    roomId,
    "com.magic.workspace.binding",
    {
      bound: true,
      displayName: binding.displayName,
      boundBy: userId,
      boundAt: binding.boundAt,
      fileCount: binding.fileCount,
    },
    userId
  );

  onClose();
};
```

#### 5.2.4 MessageComposer 集成

```tsx
// MessageComposer 修改：使用 sendWithWorkspace 替代 sendTextMessage
import { useMessageInterceptor } from "@magic/ui/hooks";
import { WorkspaceFilePicker } from "../workspace/WorkspaceFilePicker";

export function MessageComposer({ roomId }: { roomId: string }) {
  const { sendWithWorkspace } = useMessageInterceptor();
  const { binding, fileTree } = useWorkspaceBinding(roomId);
  const [text, setText] = useState("");
  const [explicitAttachments, setExplicitAttachments] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const handleSend = useCallback(async () => {
    if (!text.trim() && explicitAttachments.length === 0) return;

    await sendWithWorkspace({
      roomId,
      text,
      explicitAttachments,
    });

    setText("");
    setExplicitAttachments([]);
  }, [roomId, text, explicitAttachments, sendWithWorkspace]);

  return (
    <div>
      {/* 已选附件 chip */}
      {explicitAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {explicitAttachments.map((p) => (
            <span key={p} className="...">
              📄 {p}
              <button onClick={() => setExplicitAttachments(prev => prev.filter(x => x !== p))}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* 输入框 */}
      <div className="flex items-end gap-2 p-3">
        {/* + 按钮（含绑定文件夹等菜单） */}
        <AttachmentMenu roomId={roomId} />

        {/* 📁 工作区文件选择器（仅在已绑定时显示） */}
        {binding && (
          <button
            onClick={() => setShowPicker(true)}
            className="..."
            title="从工作区选择文件附加"
          >
            📁
            {explicitAttachments.length > 0 && (
              <span className="...">{explicitAttachments.length}</span>
            )}
          </button>
        )}

        <textarea value={text} onChange={(e) => setText(e.target.value)} ... />

        <button onClick={handleSend}>发送</button>
      </div>

      {showPicker && (
        <WorkspaceFilePicker
          fileTree={fileTree}
          initialSelected={explicitAttachments}
          onConfirm={(paths) => {
            setExplicitAttachments(paths);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
```

#### 5.2.5 WorkspaceFilePicker 组件

```tsx
// packages/ui/src/workspace/WorkspaceFilePicker.tsx
import { useState } from "react";
import { DialogOverlay } from "../common/DialogOverlay";

interface FileEntry {
  path: string;
  size: number;
  mtime: number;
}

interface Props {
  fileTree: FileEntry[];
  initialSelected: string[];
  onConfirm: (paths: string[]) => void;
  onClose: () => void;
}

export function WorkspaceFilePicker({ fileTree, initialSelected, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? fileTree.filter(f => f.path.toLowerCase().includes(filter.toLowerCase()))
    : fileTree;

  const toggle = (path: string) => {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setSelected(next);
  };

  const totalSize = fileTree
    .filter(f => selected.has(f.path))
    .reduce((sum, f) => sum + f.size, 0);

  return (
    <DialogOverlay onClose={onClose}>
      <div className="w-full max-w-md rounded-xl p-6 shadow-2xl"
           style={{ background: 'var(--bg-primary)' }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          选择要附加的文件
        </h2>

        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="过滤文件..."
          className="mt-3 w-full rounded px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
        />

        <div className="mt-3 max-h-80 overflow-y-auto">
          {filtered.map((f) => (
            <label
              key={f.path}
              className="flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer text-xs"
            >
              <input
                type="checkbox"
                checked={selected.has(f.path)}
                onChange={() => toggle(f.path)}
                className="h-4 w-4"
              />
              <span className="flex-1 truncate font-mono"
                    style={{ color: 'var(--text-primary)' }}>
                {f.path}
              </span>
              <span className="text-[10px] shrink-0"
                    style={{ color: 'var(--text-tertiary)' }}>
                {formatSize(f.size)}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs"
             style={{ color: 'var(--text-secondary)' }}>
          <span>已选 {selected.size} / {fileTree.length} 个文件 ({formatSize(totalSize)})</span>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())}
                    style={{ color: 'var(--color-danger)' }}>
              清空
            </button>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm"
                  style={{ color: 'var(--text-secondary)' }}>
            取消
          </button>
          <button onClick={() => onConfirm(Array.from(selected))}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ background: 'var(--gradient-button, linear-gradient(135deg, #6C5CE7, #3B82F6))' }}>
            附加到下一条消息
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
```

#### 5.2.6 MessageBubble 渲染附件 chip

带 workspace 附件的消息，UI 渲染时把内联代码块折叠为 chip：

```tsx
// MessageBubble.tsx 添加附件渲染逻辑
function MessageBubble({ event }: { event: any }) {
  const content = event.getContent();
  const attached = content["com.magic.workspace.attached"];

  if (attached) {
    // 提取主消息（去掉内联代码块部分）
    const mainText = content.body.split("\n────────")[0];

    return (
      <div className="message-bubble">
        <p>{mainText}</p>

        {/* 附件 chip */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {attached.files.map((f: any) => (
            <button
              key={f.path}
              className="..."
              title={`点击查看完整内容（${formatSize(f.size)}）`}
              onClick={() => /* 展开/查看 */}
            >
              📄 {f.path} · {formatSize(f.size)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 默认渲染
  return <DefaultMessageBubble event={event} />;
}
```

---

## 6. 安全性

### 6.1 文件访问控制

- **路径越界防护**：`resolveSafePath()` 防止 `../../etc/passwd`
- **忽略列表**：`.env` / `.ssh` / `id_rsa` 等敏感文件即使用户主动选择也拒绝读取
- **大小限制**：单文件 5 MB（自动附加） / 10 MB（显式选择硬上限）
- **数量限制**：单条消息最多 5 个自动附加文件，1 MB 总大小

### 6.2 用户授权

- 必须用户主动通过原生选择器选择文件夹
- 必须勾选"我理解"才能确认绑定
- 自动附加默认开启，但**可在设置中关闭**
- 每条消息发送时，用户能看到附件 chip 知道附了哪些文件

### 6.3 隐私权衡（v3 需要明示）

⚠️ **与 v2 的关键差异**：v3 的文件**会通过 Matrix 上传到 Homeserver**（作为消息正文或 mxc:// 附件）。

- **E2EE 房间**：附件被 Megolm 加密，仅房间成员可解密 ✅
- **非 E2EE 房间**：Homeserver 管理员可见 ⚠️

绑定确认对话框中明确告知用户。

### 6.4 默认忽略列表

```
.ssh/**, .aws/**, .gnupg/**, .config/**/credentials*
*.pem, *.key, *.p12, *.pfx, *.jks, *.keystore
id_rsa*, id_ed25519*, id_ecdsa*
.env, .env.*, *.envrc
.npmrc, .pypirc, .gem/credentials
.docker/config.json, .kube/config
node_modules/**, .git/**, dist/**, build/**, ...
```

---

## 7. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 群聊房间和私聊都能在 + 菜单看到"绑定本地文件夹" | 视觉检查两种场景 |
| AC-2 | 点击后弹出原生文件选择器 | 手动验证 |
| AC-3 | 选择文件夹后显示扫描结果 | 手动验证 |
| AC-4 | 必须勾选"我理解"才能绑定 | 手动验证 |
| AC-5 | 绑定后立即在房间内看到一条普通聊天消息：「📁 已绑定本地工作区: TestMagic ... 文件清单：...」 | 视觉检查 |
| AC-6 | 文件超过 100 个时，绑定通告附带 workspace-manifest.txt 文件 | 创建大文件夹验证 |
| AC-7 | ChannelHeader 显示 📁 状态指示 | 视觉检查 |
| AC-8 | MessageComposer 工具栏出现 📁 按钮 | 视觉检查 |
| AC-9 | **核心**：在 Agent 私聊中绑定文件夹后，发送 "看看 \`src/main.py\` 写得怎么样"，Agent 收到的消息中包含 main.py 的实际代码内容 ⭐ | Element Web 查 raw 消息 |
| AC-10 | **核心**：Agent 基于实际文件内容回答（不再说"我无法访问本地文件"） ⭐ | 实测对话 |
| AC-11 | 消息正文中含反引号路径如 \`src/main.py\` 自动触发附加 | 实测发送 |
| AC-12 | 唯一文件名匹配自动附加（如 "看看 main.py"，且 workspace 中只有一个 main.py） | 实测发送 |
| AC-13 | 多个同名文件不自动附加（避免歧义） | 创建多个同名文件验证 |
| AC-14 | 点击 📁 按钮弹出 WorkspaceFilePicker，可勾选文件 | 视觉验证 |
| AC-15 | 选中的文件以 chip 形式显示在输入框上方 | 视觉验证 |
| AC-16 | 发送消息后 chip 清空 | 实测 |
| AC-17 | 单文件 < 50KB 文本走内联代码块（在消息 body 内） | 检查 raw 消息 |
| AC-18 | 单文件 > 50KB 走 m.file 附件（独立消息） | 检查 raw 消息 |
| AC-19 | 二进制文件走 m.file（图片走 m.image） | 实测 png/jpg |
| AC-20 | 路径越界请求被拒绝（如 \`../../etc/passwd\`） | 故意构造 |
| AC-21 | .env 等敏感文件无法被附加（即使用户显式选择） | 创建 .env 验证 |
| AC-22 | 设置面板可关闭"自动附加"开关 | 视觉操作 |
| AC-23 | 关闭后消息中提到文件路径不再自动附加（仍可用 📁 按钮） | 实测 |
| AC-24 | 解绑后 ChannelHeader 不再显示 📁，📁 按钮消失 | 视觉验证 |
| AC-25 | 重启应用后绑定关系恢复 | 重启验证 |
| AC-26 | 单条消息最多附加 5 个文件，超出时提示用户 | 故意触发多匹配 |
| AC-27 | `pnpm typecheck && pnpm build` 通过 | 命令验证 |

---

## 8. 实现任务（按执行顺序）

### 任务 1：Electron 主进程基础设施

**创建文件**：
- `apps/desktop/src/main/workspace/IgnoreEngine.ts`
- `apps/desktop/src/main/workspace/WorkspaceManager.ts`（按 §5.1.2）
- `apps/desktop/src/main/ipc/workspace.ts`（按 §5.1.1）

**修改文件**：
- `apps/desktop/src/main/index.ts` —— 初始化 WorkspaceManager 并注册 IPC

```typescript
const workspace = new WorkspaceManager((roomId, binding, files) => {
  BrowserWindow.getAllWindows().forEach((win) =>
    win.webContents.send("workspace:tree-changed", { roomId, binding, files })
  );
});
await workspace.load();
registerWorkspaceIpcHandlers(workspace);
app.on("before-quit", async () => { await workspace.shutdown(); });
```

**依赖安装**：
```bash
pnpm add chokidar minimatch -F @magic/desktop
pnpm add -D @types/minimatch -F @magic/desktop
```

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
    getFileTree: (rid: string) => ipcRenderer.invoke("workspace:getFileTree", rid),
    revealInFinder: (rid: string) => ipcRenderer.invoke("workspace:revealInFinder", rid),
    readFile: (rid: string, p: string) => ipcRenderer.invoke("workspace:readFile", rid, p),
    setAutoAttach: (rid: string, e: boolean) => ipcRenderer.invoke("workspace:setAutoAttach", rid, e),
    getAutoAttach: (rid: string) => ipcRenderer.invoke("workspace:getAutoAttach", rid),

    onTreeChanged: (h: any) => {
      ipcRenderer.on("workspace:tree-changed", h);
      return () => ipcRenderer.removeListener("workspace:tree-changed", h);
    },
  },
});
```

更新 `preload/index.d.ts`。

**验证**：`pnpm typecheck`

---

### 任务 3：核心 Hook —— useMessageInterceptor

**创建文件**：`packages/ui/src/hooks/useMessageInterceptor.ts`（按 §5.2.1）

包含：
- 文件路径检测（4 种策略）
- 文件读取（IPC 调用 main 进程）
- 内联 vs 附件分类
- 主消息 + 附件消息发送

**验证**：`pnpm typecheck`

---

### 任务 4：useWorkspaceBinding Hook

**创建文件**：`packages/ui/src/hooks/useWorkspaceBinding.ts`（按 §5.2.2）

**验证**：`pnpm typecheck`

---

### 任务 5：UI 组件

**创建文件**：
- `packages/ui/src/workspace/BindFolderButton.tsx`（沿用前版基础上改文案）
- `packages/ui/src/workspace/BindFolderConfirmDialog.tsx`（按 §5.2.3 调用 bind 后发送通告消息）
- `packages/ui/src/workspace/WorkspaceFilePicker.tsx`（按 §5.2.5）
- `packages/ui/src/workspace/WorkspaceSection.tsx`（设置面板模块）
- `packages/ui/src/workspace/WorkspaceIndicator.tsx`（ChannelHeader 中的小图标）

**验证**：`pnpm typecheck`

---

### 任务 6：MessageComposer 集成

**修改文件**：`packages/ui/src/composer/MessageComposer.tsx`

按 §5.2.4：
- 引入 `useMessageInterceptor` 和 `useWorkspaceBinding`
- 加 📁 按钮
- 加附件 chip 显示
- 替换 `sendTextMessage` 为 `sendWithWorkspace`

**验证**：`pnpm typecheck`

---

### 任务 7：MessageBubble 渲染附件 chip

**修改文件**：`packages/ui/src/chat/MessageBubble.tsx`

按 §5.2.6 检测 `com.magic.workspace.attached` 字段，把内联代码块折叠为可点击 chip。

**验证**：`pnpm typecheck`

---

### 任务 8：集成到 ChannelHeader + 设置面板

**修改文件**：
- `packages/ui/src/chat/ChannelHeader.tsx` —— 显示 📁 状态指示
- `packages/ui/src/settings/RoomSettingsPanel.tsx` —— 加 WorkspaceSection
- `packages/ui/src/settings/DMSettingsPanel.tsx` —— 加 WorkspaceSection

**验证**：`pnpm typecheck`

---

### 任务 9：全局验证

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm dev:desktop
```

按 §7 验收标准逐项手动测试，**重点验证 AC-9 和 AC-10**：

1. 在 manager 私聊中绑定 TestMagic 文件夹
2. 发送 "看看 `src/main.py` 写得怎么样"
3. 用 Element Web 打开同一房间，查看 raw 事件
4. 应该看到消息 body 中包含完整的 main.py 代码内容（在 ``` 代码块内）
5. Agent 应基于代码实际内容回答，不再说"无法访问本地文件"

完成后提交：
```bash
git add -A
git commit -m "feat: 022 v3 - workspace folder binding via Matrix native attachments"
```

---

## 9. v1 vs v2 vs v3 对照

| 项目 | v1（已废弃） | v2（已废弃） | v3（本版） |
|------|------|------|------|
| 后端依赖 | Magic 后端 + MinIO | 无 | 无 |
| 自定义协议 | HTTP API | 自定义 Matrix 事件 | **无** |
| Agent 侧改造 | 容器挂载 MinIO | 实现 read_request/response | **无需任何改造** ⭐ |
| 文件传输方式 | MinIO 上传 | 应该走 read_response（实际不工作） | Matrix 原生 m.file / 内联代码块 |
| 触发文件传输 | 绑定时全量 | Agent 发请求 | 用户消息提到文件路径 |
| 是否实际工作 | ✅ 但太重 | ❌ Agent 不实现协议 | ✅ Agent 看普通消息就行 |

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|---------|
| 自动附加误触发 | 把不想发的文件发出去 | 用户能在 chip 看到，发送前可清空；可关闭自动附加 |
| 文件路径检测不准 | 漏检测 / 误检测 | 提供 `@file:path` 显式语法 + 📁 按钮兜底 |
| 大文件污染聊天 | 消息体积大 | 50KB 阈值切分 inline / attachment；硬上限 5 MB / 1 MB total |
| 隐私：文件上传到 Homeserver | 元数据/内容泄露 | 绑定确认明示；推荐 E2EE 房间；忽略列表强制过滤敏感文件 |
| 路径越界 | 安全 | resolveSafePath 双重校验 |
| chokidar CPU | 大文件夹监听 | 防抖 + 忽略列表 + 文件数上限 |