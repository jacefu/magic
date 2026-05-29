# Spec 022: 工作区上下文注入（系统提示词式 · 无桥接版）

> 优先级: P0 | 波次: Wave 6 | 预估: 3-4 天 | 前置依赖: 003-electron-shell, 005-room-list, 020-ui-polish, 021-room-settings
> 适用产品: **AgentTeams 客户端**（HiClaw 商业版）

---

## 0. 设计演进史（必读，避免重蹈覆辙）

| 版本 | 思路 | 为什么废弃 |
|------|------|-----------|
| v1 | 上传文件到后端 + MinIO | 太重，需要独立后端 |
| v2 | 自定义 Matrix 协议 read_request/response | 期望第三方 Agent 实现协议，行不通 |
| v3 | 用户提到文件 → 客户端推送内容 | 太被动 |
| v4 | Tool-Use 桥接（Agent 调 ls/cat 经 Matrix 回客户端） | 引入桥接协议 + 要求 Agent 改造，过度设计 |
| v5 | 反应式投影：把目录树/文件作为**可见消息**发到聊天 | 污染聊天区 |
| **v6（本版）** | **上下文注入消息正文 + UI 隐藏**：目录树等作为"系统提示词"塞进每条消息的 body，UI 截断隐藏，Agent 读 body 时自然拿到 | ✅ 客户端不碰 LLM、无桥接、无后端、**Agent 零改造**、聊天区干净 |

### 核心理念

**AgentTeams 客户端把工作区上下文当作"系统提示词"，注入到每条消息的正文（body）里。Agent 读 body 时自然拿到，无需任何改造；用户在 UI 上看不到这些上下文（被截断隐藏）。**

关键认知（v6 相比 v5 的进化）：
- 上下文不放在**单独的自定义字段**（那种字段 Agent 默认不读，需要 Agent 特地解析）
- 而是放进**消息正文 body**（Agent 处理任何消息本来就读 body → 自动进 LLM 输入）
- "不显示给用户"纯粹是 **AgentTeams 客户端 UI 渲染时截断**，与 Agent 无关

```
之前(v5,污染聊天):
  目录树作为一条可见消息发出去 → 聊天区被占满

现在(v6,干净):
  目录树塞进用户消息 body 的 <workspace_context> 区块
  → Agent 读 body 拿到 ✅
  → UI 渲染时把这个区块截掉，只显示用户文字 ✅
```

### 不可回避的事实

要让**远端 Agent**感知到**本地文件/目录**，信息必须经 Matrix 传过去（加密房间里被 Megolm 加密）。这是物理隔离决定的。客户端做的只是把这个过程藏在消息正文里、对用户透明。

---

## 1. 目标

AgentTeams 客户端绑定本地工作区后：

1. **目录树注入**：用户在绑定的对话里每发一条消息，客户端自动把目录树（+ 项目说明）作为"系统提示词"注入到消息 body，Agent 自然感知，用户看不到
2. **文件内容反应式注入**：当对话中任何人提到工作区内的文件路径时，客户端读取该文件，把内容作为一条消息（body 含内容）发出，Agent 读到，UI 折叠隐藏
3. **系统提示词分层**：支持全局 `~/.agentteams/agentteams.md`（所有对话都带）+ 每个绑定的专属说明（App 设置里填），一起注入

### 核心原则

1. **客户端不调 LLM** —— 只 ls/cat + 注入消息 + 发消息
2. **Agent 零改造** —— 上下文在 body 里，Agent 读 body 就有，不需要读任何特殊字段
3. **无桥接、无后端、无 MinIO**
4. **聊天区干净** —— 上下文被 UI 截断/折叠，用户只看到真实对话
5. **私聊 + 房间统一**

### 用户故事

- **核心**：我把 Flask 项目文件夹绑定到与 Worker Agent 的私聊，在 AgentTeams 设置里给这个绑定填了专属说明"认证用 JWT，遵循 PEP8"。我发"重构认证模块"——Agent 自动知道项目结构和规矩，回复时说"我看下 `src/auth.py`"，该文件内容自动出现，Agent 基于内容重构。全程我的聊天区只看到自己的话和 Agent 的话，没有被目录树/文件内容刷屏，我的项目文件夹也没被塞进任何配置文件。

---

## 2. 存储模型（重要）

⚠️ **AgentTeams 是一个 Mac App，不是 CLI 工具**。所以它的配置是**全局的、属于这个 App 的**，存在用户主目录下的 `~/.agentteams/`（类似各类 AI 客户端的习惯，用户好找）。**绝不往用户绑定的文件夹里塞任何文件**——那会污染用户的项目目录。

| 层 | 存什么 | 存哪 | 说明 |
|----|--------|------|------|
| **1. App 全局配置** | 绑定关系、全局 ignore、全局系统提示词 | `~/.agentteams/` | App 全局唯一，用户好找、可手动编辑 |
| **2. 每绑定专属说明** | 某个文件夹专属的项目说明 | 同样存在 `~/.agentteams/workspaces.json` 里那条绑定记录下 | 在 App 设置界面填，不往用户文件夹放文件 |
| **3. 目录树** | 目录结构 | **不落盘**，实时扫描 + 内存缓存 | 文件系统是唯一真相，落盘必过期；chokidar 监听到增删即失效重扫 |

### `~/.agentteams/` 全局目录结构

```
~/.agentteams/                   ← AgentTeams App 的全局配置目录（用户主目录下）
├── workspaces.json              # 绑定关系（roomId → 本地路径）+ 每绑定专属说明
├── ignore                       # 全局排除规则（所有绑定通用）
└── agentteams.md                # 全局系统提示词（所有对话都带）⭐
```

`~/.agentteams/agentteams.md`（全局系统提示词，类似 CLAUDE.md / AGENTS.md）示例：

```markdown
# AgentTeams 全局说明
回复请用中文，简洁清晰。
涉及代码时，优先给出可直接运行的完整代码。
不确定时先问，不要臆测。
```

`workspaces.json` 里每个绑定可带一段**专属说明**（在 App 设置界面填）：

```json
{
  "version": 6,
  "bindings": {
    "!roomA:server": {
      "localPath": "/Users/jacefu/flask-backend",
      "displayName": "flask-backend",
      "boundBy": "@jacefu:server",
      "boundAt": 1746876000000,
      "context": "这是 Flask 后端项目，认证用 JWT，遵循 PEP8，不要改 legacy/ 目录"
    },
    "!roomB:server": {
      "localPath": "/Users/jacefu/go-tool",
      "displayName": "go-tool",
      "context": "Go 项目，遵循 Go 官方风格"
    }
  }
}
```

⚠️ 注意：用户**绑定的文件夹本身完全不被修改**，没有任何 `.agentteams` 子目录写进去。所有配置都在 `~/.agentteams/`。

---

## 3. "系统提示词"由什么组成

注入到每条用户消息 body 的上下文 =

```
① 目录树                      （客户端实时扫描，不落盘）
② ~/.agentteams/agentteams.md  （全局系统提示词，所有对话都带，如果存在）
③ 该绑定的专属说明              （App 设置里填，存 workspaces.json，如果填了）
④ 客户端固定说明               （硬编码："需要文件内容时在回复中提路径即可"）
```

其中 ②③ 是叠加关系：② 全局是基础（所有对话都带），③ 是针对当前这个绑定文件夹的额外说明，追加在 ② 之后。

四部分拼成一个 `<workspace_context>` 区块，前置到用户消息正文。

---

## 4. 两个注入机制

### 4.1 目录树 + 系统提示词注入（每条用户消息）

用户在绑定的对话里输入 `帮我重构认证模块`，客户端**实际发出**的消息（body 中的 `## 文件内容获取机制` 段是关键，详见下面 §4.2.1）：

```json
{
  "type": "m.room.message",
  "content": {
    "msgtype": "m.text",
    "body": "<workspace_context name=\"TestMagic\">\n## 目录结构\n├── README.md\n├── src/\n│   ├── main.py\n│   └── auth.py\n└── tests/test_main.py\n\n## 项目说明\n这是一个 Flask 后端项目，认证用 JWT。\n代码规范：遵循 PEP8。\n\n## 文件内容获取机制（重要）\n- 当你或用户提到本工作区内的某个文件路径（如 `src/auth.py`），**系统会在聊天历史中自动追加一条以「📂 [工作区文件 · 自动注入]」开头的消息，body 即为该文件的完整内容**。\n- 该消息可能出现在你当前正在回答的这条用户消息之前——请向上扫描最近若干条消息查找它。\n- 不要调用文件工具、不要让用户上传、不要请求路径，直接读那条注入消息的 body。\n- 找不到匹配的注入消息说明已去重过，请沿用上次出现的内容。\n- 工作区路径与你本机文件系统完全无关，不要尝试用 ls/cat 等工具访问。\n</workspace_context>\n\n帮我重构认证模块",
    "com.agentteams.workspace.injected": {
      "workspace": "TestMagic",
      "contextLength": 320
    }
  }
}
```

效果：
- **Agent LLM 看到**：完整 body（工作区上下文 + 用户请求）→ 自然当系统提示词用 ✅
- **用户在 AgentTeams 看到**：只有"帮我重构认证模块"（UI 截掉 `<workspace_context>` 区块）✅
- **Agent 零改造**：它读 body 本来就这么读 ✅
- **每条消息都带**：正是"默认带着系统提示词" ✅

⚠️ `com.agentteams.workspace.injected` 字段**只是给 UI 用的标记**（知道这条消息需要截断），不是给 Agent 读的——Agent 读 body 即可。

### 4.2 文件内容反应式注入（提到文件时）

目录树小、稳定，适合每条消息都带。文件内容大，且是反应式的（Agent 提到某文件时才需要），不能等下一条用户消息。所以单独发一条消息，**内容放在该消息 body 里**：

监听对话里每条新消息（跳过注入消息自身，防循环）：

```
新消息到达
  → 跳过：带 com.agentteams.workspace.projection 标记的（防循环）
  → 检测 body 中的文件路径引用
  → 命中且工作区内存在、未投影过该 (path, mtime)：
       → 读取文件
       → 发一条消息，body = 文件内容
       → UI 折叠成小卡片
```

文件内容消息（body 要刻意提示词工程化——见 §4.2.1）：

```json
{
  "type": "m.room.message",
  "content": {
    "msgtype": "m.text",
    "body": "📂 [工作区文件 · 自动注入] `src/auth.py` (2.3 KB)\n以下三个反引号之间是该文件的**完整内容**（系统已直接从用户磁盘读取）。若用户随后询问这个文件、或你之前提到过这个路径，请直接基于以下内容回答，**不要**再要求用户上传或提供路径：\n\n```python\nimport jwt\n...\n```",
    "com.agentteams.workspace.projection": {
      "kind": "file", "path": "src/auth.py", "size": 2345, "mtime": 1746876000000
    }
  }
}
```

- Agent 读 body → 看到「📂 [工作区文件 · 自动注入]」前缀 → 把代码块当作权威文件内容继续分析（零改造）
- UI 检测到 `projection` 字段 → 折叠成小卡片 `📄 src/auth.py · 2.3 KB [展开]`

### 4.2.1 为什么 body 必须刻意"啰嗦"——Prompt Engineering 决定生死

仅仅写 `📄 src/auth.py\n\`\`\`...\`\`\`` 在实测中失败了：Agent 把它当作"路径预告"，
继续要求用户上传，根本不读代码块。两处必须同时做：

1. **投影消息的 body**：前缀必须明确表达"这就是文件内容、不是预告"——使用
   `📂 [工作区文件 · 自动注入]` + 一句 "以下是完整内容，不要再问用户上传"。
   （参考实现见 §6.2 `buildProjectionBody`）

2. **workspace_context 块的"## 文件内容获取机制"段**：必须告诉 Agent：
   - 文件内容会作为**独立的、带 📂 前缀的历史消息**出现
   - 该消息**可能在它正在回答的这条用户消息之前**——要往上翻
   - 不要调用任何文件工具、不要让用户上传、不要请求路径
   - 工作区路径**与 Agent 本机的 / 路径无关**——很多 Agent 默认会去 ls /
     自己 workspace 的目录，遇到 "user.yaml" 就以为是问自己 home 下的文件

任何一处缺失，Agent 都会回到"我没有访问你文件的能力，请上传"的失败模式。

> ⚠️ **必须用 `m.text`，不能用 `m.notice`**。Matrix 生态约定 `m.notice` 是 bot
> 自动消息、其他 bot/Agent 应主动跳过以防互相回环（[Matrix Spec §11.4.2.1.2](https://spec.matrix.org/v1.11/client-server-api/#mnotice)）。
> 用了 `m.notice` 就跟"Agent 零改造、读 body 就拿到上下文"的核心约束直接冲突
> ——Agent 会忽略整条消息，看不到文件内容。本规范的循环防护靠 `projection`
> 标记，**不依赖** `m.notice`，所以投影文件必须以 `m.text` 发出。
>
> `file_error` 投影同理用 `m.text`，让 Agent 知道"想读但读不到"；只有纯系统
> 提示（`unbind`）才用 `m.notice`，因为不需要 Agent 反应。

---

## 5. 防循环与去重

### 5.1 防循环（关键）

文件内容消息的 body 含路径（"📄 src/auth.py"）。检测器若扫到自己发的注入消息会再次命中 → 死循环。

**防护**：
- 文件内容投影消息带 `com.agentteams.workspace.projection` 标记 → 检测器遇到即跳过
- 用户消息注入的 `<workspace_context>` 区块也要跳过检测（检测只针对区块**之外**的用户真实文字，避免目录树里的路径触发投影）

```typescript
// 检测前：剥离 <workspace_context>...</workspace_context> 区块
const userText = stripWorkspaceContext(body);
const detected = detectFilePaths(userText, treePaths);
```

### 5.2 去重

每房间维护 `Map<path, mtime>`：
- 同一 `(path, mtime)` 已投影 → 跳过（内容已在历史）
- 文件被改（mtime 变）→ 重新投影最新内容
- 解绑 → 清空

---

## 6. 技术规格

### 6.1 Main 进程：WorkspaceManager

```typescript
// apps/desktop/src/main/workspace/WorkspaceManager.ts
import * as path from "path";
import * as os from "os";
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
  context?: string;     // ⭐ 该绑定专属说明（App 设置里填）
}

interface FileNode { path: string; isDirectory: boolean; size: number; mtime: number; }

export class WorkspaceManager {
  private bindings = new Map<string, Binding>();
  private treeCache = new Map<string, { nodes: FileNode[]; truncated: boolean; ts: number }>();
  private watchers = new Map<string, FSWatcher>();
  private configDir: string;       // ~/.agentteams/
  private storageFile: string;     // ~/.agentteams/workspaces.json
  private globalIgnoreFile: string; // ~/.agentteams/ignore
  private globalContextFile: string; // ~/.agentteams/agentteams.md
  private onChange: (roomId: string, binding: Binding | null, kind: "bind" | "tree-changed" | "unbind") => void;

  private readonly DEFAULT_IGNORES = [
    "node_modules/**", ".git/**", ".svn/**", "dist/**", "build/**", "out/**",
    "target/**", "__pycache__/**", ".venv/**", "venv/**",
    ".env", ".env.*", "*.log", "*.tmp", ".DS_Store", "Thumbs.db",
    ".idea/**", ".vscode/**", "*.lock", "package-lock.json", "pnpm-lock.yaml",
    ".ssh/**", ".aws/**", ".gnupg/**",
    "*.pem", "*.key", "*.p12", "*.pfx", "id_rsa*", "id_ed25519*",
  ];
  private readonly MAX_FILE_READ = 5 * 1024 * 1024;
  private readonly MAX_TREE_FILES = 500;
  private readonly TREE_CACHE_TTL = 5000; // 内存缓存 5 秒
  private readonly MAX_CONTEXT_LEN = 8 * 1024; // 单段说明上限 8KB

  constructor(onChange: WorkspaceManager["onChange"]) {
    // ⭐ 全局配置目录：~/.agentteams/（不是 Electron userData）
    this.configDir = path.join(os.homedir(), ".agentteams");
    this.storageFile = path.join(this.configDir, "workspaces.json");
    this.globalIgnoreFile = path.join(this.configDir, "ignore");
    this.globalContextFile = path.join(this.configDir, "agentteams.md");
    this.onChange = onChange;
  }

  async load(): Promise<void> {
    // 确保 ~/.agentteams/ 存在
    await fs.mkdir(this.configDir, { recursive: true }).catch(() => {});
    try {
      const data = JSON.parse(await fs.readFile(this.storageFile, "utf-8"));
      for (const [rid, b] of Object.entries(data.bindings ?? {})) {
        try {
          await fs.access((b as Binding).localPath);
          this.bindings.set(rid, b as Binding);
          await this.startWatching(rid, b as Binding);
        } catch { console.warn(`绑定路径不存在: ${(b as Binding).localPath}`); }
      }
    } catch {}
  }

  private async save(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true }).catch(() => {});
    await fs.writeFile(this.storageFile, JSON.stringify({
      version: 6, bindings: Object.fromEntries(this.bindings.entries()),
    }, null, 2));
  }

  // ===== 绑定 =====
  async bind(roomId: string, localPath: string, boundBy: string): Promise<Binding> {
    const stat = await fs.stat(localPath);
    if (!stat.isDirectory()) throw new Error("选择的不是文件夹");
    if (this.bindings.has(roomId)) await this.unbind(roomId, true);

    const binding: Binding = {
      roomId, localPath, displayName: path.basename(localPath), boundBy, boundAt: Date.now(),
    };
    this.bindings.set(roomId, binding);
    await this.save();
    await this.startWatching(roomId, binding);
    this.onChange(roomId, binding, "bind");
    return binding;
  }

  async unbind(roomId: string, silent = false): Promise<void> {
    const w = this.watchers.get(roomId);
    if (w) { await w.close(); this.watchers.delete(roomId); }
    this.bindings.delete(roomId);
    this.treeCache.delete(roomId);
    await this.save();
    if (!silent) this.onChange(roomId, null, "unbind");
  }

  getBinding(roomId: string): Binding | null { return this.bindings.get(roomId) ?? null; }
  revealInFinder(roomId: string): void {
    const b = this.bindings.get(roomId);
    if (b) shell.openPath(b.localPath);
  }

  // ===== 忽略列表：默认 + ~/.agentteams/ignore（全局） =====
  private async buildIgnore(localPath: string): Promise<IgnoreEngine> {
    const ignore = new IgnoreEngine(this.DEFAULT_IGNORES);
    // 全局 ignore（不再读工作区里的文件）
    try {
      const txt = await fs.readFile(this.globalIgnoreFile, "utf-8");
      ignore.addPatterns(txt.split("\n"));
    } catch {}
    return ignore;
  }

  // ===== 读目录树（实时扫描 + 内存缓存） =====
  async scanTree(roomId: string): Promise<{ nodes: FileNode[]; truncated: boolean }> {
    const binding = this.bindings.get(roomId);
    if (!binding) return { nodes: [], truncated: false };

    // 内存缓存（短 TTL，被 watcher 主动失效）
    const cached = this.treeCache.get(roomId);
    if (cached && Date.now() - cached.ts < this.TREE_CACHE_TTL) {
      return { nodes: cached.nodes, truncated: cached.truncated };
    }

    const ignore = await this.buildIgnore(binding.localPath);
    const nodes: FileNode[] = [];
    let truncated = false;

    const walk = async (dir: string): Promise<void> => {
      if (truncated) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const e of sorted) {
        if (truncated) break;
        const full = path.join(dir, e.name);
        const rel = path.relative(binding.localPath, full).replace(/\\/g, "/");
        if (ignore.matches(rel)) continue;
        try {
          const st = await fs.stat(full);
          nodes.push({ path: rel, isDirectory: e.isDirectory(), size: st.size, mtime: st.mtimeMs });
          if (nodes.length >= this.MAX_TREE_FILES) { truncated = true; break; }
          if (e.isDirectory()) await walk(full);
        } catch {}
      }
    };
    await walk(binding.localPath);
    this.treeCache.set(roomId, { nodes, truncated, ts: Date.now() });
    return { nodes, truncated };
  }

  // ===== 读系统提示词：全局 ~/.agentteams/agentteams.md + 该绑定专属 context =====
  async getSystemContext(roomId: string): Promise<{ global: string | null; binding: string | null }> {
    const binding = this.bindings.get(roomId);
    let global: string | null = null;
    try {
      global = (await fs.readFile(this.globalContextFile, "utf-8")).slice(0, this.MAX_CONTEXT_LEN);
    } catch {}
    const bindingCtx = binding?.context
      ? binding.context.slice(0, this.MAX_CONTEXT_LEN)
      : null;
    return { global, binding: bindingCtx };
  }

  // ===== 设置某个绑定的专属说明（App 设置界面调用） =====
  async setBindingContext(roomId: string, context: string): Promise<void> {
    const b = this.bindings.get(roomId);
    if (b) {
      b.context = context.slice(0, this.MAX_CONTEXT_LEN);
      await this.save();
    }
  }

  // ===== 读/写全局系统提示词（App 设置界面调用） =====
  async getGlobalContext(): Promise<string> {
    try { return await fs.readFile(this.globalContextFile, "utf-8"); }
    catch { return ""; }
  }

  async setGlobalContext(text: string): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true }).catch(() => {});
    await fs.writeFile(this.globalContextFile, text);
  }

  // ===== 读文件内容 =====
  async readFile(roomId: string, relPath: string): Promise<{
    ok: boolean; content?: string; isText?: boolean; base64?: string;
    size?: number; mtime?: number; error?: string;
  }> {
    const binding = this.bindings.get(roomId);
    if (!binding) return { ok: false, error: "未绑定" };
    const safe = this.resolveSafe(binding.localPath, relPath);
    if (!safe) return { ok: false, error: "路径越界" };
    const ignore = await this.buildIgnore(binding.localPath);
    if (ignore.matches(relPath)) return { ok: false, error: "文件被忽略列表排除" };
    try {
      const st = await fs.stat(safe);
      if (!st.isFile()) return { ok: false, error: "不是文件" };
      if (st.size > this.MAX_FILE_READ) return { ok: false, error: `文件过大（${this.fmt(st.size)}）` };
      const buf = await fs.readFile(safe);
      const isText = this.isText(buf);
      return isText
        ? { ok: true, isText: true, content: buf.toString("utf-8"), size: st.size, mtime: st.mtimeMs }
        : { ok: true, isText: false, base64: buf.toString("base64"), size: st.size, mtime: st.mtimeMs };
    } catch (err: any) {
      return { ok: false, error: err.code === "ENOENT" ? "文件不存在" : err.message };
    }
  }

  // ===== 文件监听（增删 → 失效缓存 + 通知树变化） =====
  private async startWatching(roomId: string, binding: Binding): Promise<void> {
    const ignore = await this.buildIgnore(binding.localPath);
    const watcher = chokidar.watch(binding.localPath, {
      ignored: (fp: string) => {
        const rel = path.relative(binding.localPath, fp).replace(/\\/g, "/");
        return rel ? ignore.matches(rel) : false;
      },
      persistent: true, ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });
    let timer: NodeJS.Timeout | null = null;
    const debounced = () => {
      this.treeCache.delete(roomId); // 失效缓存
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => this.onChange(roomId, binding, "tree-changed"), 2000);
    };
    watcher.on("add", debounced);
    watcher.on("unlink", debounced);
    watcher.on("addDir", debounced);
    watcher.on("unlinkDir", debounced);
    this.watchers.set(roomId, watcher);
  }

  private resolveSafe(root: string, rel: string): string | null {
    const n = path.normalize(rel).replace(/^[/\\]+/, "");
    const r = path.resolve(root, n);
    if (!r.startsWith(root + path.sep) && r !== root) return null;
    return r;
  }
  private isText(buf: Buffer): boolean {
    const s = buf.slice(0, 8192);
    if (s.includes(0)) return false;
    try { const d = s.toString("utf-8"); return (d.match(/\uFFFD/g) || []).length <= s.length * 0.01; }
    catch { return false; }
  }
  private fmt(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }
  async shutdown(): Promise<void> {
    for (const w of this.watchers.values()) await w.close();
    this.watchers.clear();
  }
}
```

### 6.2 Renderer：useWorkspaceInjection（核心）

```typescript
// packages/ui/src/hooks/useWorkspaceInjection.ts
import { useCallback, useEffect, useRef } from "react";
import { getClient } from "@agentteams/matrix-client";

const MAX_FILES_PER_MESSAGE = 3;
const INLINE_SIZE_THRESHOLD = 50 * 1024;
const CTX_OPEN = "<workspace_context";
const CTX_CLOSE = "</workspace_context>";

interface FileNode { path: string; isDirectory: boolean; size: number; mtime: number; }

/**
 * 工作区上下文注入。两个职责：
 * A. sendMessage 包装器：发消息前，把目录树 + 全局/专属说明注入到 body
 * B. 监听新消息：检测文件引用 → 投影文件内容
 */
export function useWorkspaceInjection() {
  const projected = useRef<Map<string, Map<string, number>>>(new Map());

  // ===== A. 发送时注入工作区上下文到 body =====
  const sendWithContext = useCallback(async (roomId: string, userText: string) => {
    const client = getClient();
    if (!client) throw new Error("client 未初始化");

    const binding = await window.electron?.workspace.getBinding(roomId);
    if (!binding) {
      // 未绑定，普通发送
      return client.sendTextMessage(roomId, userText);
    }

    // 构造工作区上下文
    const { nodes, truncated } = await window.electron!.workspace.scanTree(roomId);
    const tree = renderTree(nodes);
    const { global, binding: bindingCtx } = await window.electron!.workspace.getSystemContext(roomId);

    let ctxBlock = `${CTX_OPEN} name="${binding.displayName}">\n## 目录结构\n${tree}`;
    if (truncated) ctxBlock += `\n（目录较大，仅列出前 ${nodes.length} 项）`;
    if (global) ctxBlock += `\n\n## 全局说明\n${global}`;
    if (bindingCtx) ctxBlock += `\n\n## 项目说明\n${bindingCtx}`;
    // 见 §4.2.1——这段提示要刻意"啰嗦"，否则 Agent 会无视投影。
    ctxBlock += `\n\n## 文件内容获取机制（重要）\n` +
      `- 当你或用户提到本工作区内的某个文件路径（如 \`${exampleFile(nodes)}\`），` +
      `**系统会在聊天历史中自动追加一条以「📂 [工作区文件 · 自动注入]」开头的消息，body 即为该文件的完整内容**。\n` +
      `- 该消息可能出现在你当前正在回答的这条用户消息之前——请向上扫描最近若干条消息查找它。\n` +
      `- 不要调用文件工具、不要让用户上传、不要请求路径，直接读那条注入消息的 body。\n` +
      `- 找不到匹配的注入消息说明已去重过，请沿用上次出现的内容。\n` +
      `- 工作区路径与你本机文件系统完全无关，不要尝试用 ls/cat 等工具访问。\n` +
      `${CTX_CLOSE}`;

    const fullBody = `${ctxBlock}\n\n${userText}`;

    return client.sendEvent(roomId, "m.room.message", {
      msgtype: "m.text",
      body: fullBody,
      "com.agentteams.workspace.injected": {
        workspace: binding.displayName,
        contextLength: ctxBlock.length,  // UI 截断用
      },
    });
  }, []);

  // ===== B. 监听新消息 → 文件内容反应式投影 =====
  useEffect(() => {
    const client = getClient();
    if (!client) return;

    // 树变化时不主动发消息（树通过下次用户消息注入即可），仅在解绑时通知
    const changeHandler = async (_e: any, { roomId, binding, kind }: any) => {
      const client2 = getClient();
      if (kind === "unbind") {
        projected.current.delete(roomId);
        // 解绑可选发一条提示（也可不发，保持安静）
        await client2?.sendEvent(roomId, "m.room.message", {
          msgtype: "m.notice",
          body: `📁 已解绑工作区：${binding?.displayName ?? ""}`,
          "com.agentteams.workspace.projection": { kind: "unbind" },
        });
      }
      // bind / tree-changed：不主动发消息，等下条用户消息自然注入最新树
    };
    const unsubChange = window.electron?.workspace.onChange?.(changeHandler);

    const timelineHandler = async (event: any, room: any, toStartOfTimeline: boolean) => {
      if (toStartOfTimeline) return;
      if (event.getType() !== "m.room.message") return;
      const content = event.getContent();

      // ⭐ 防循环：跳过文件投影消息
      if (content["com.agentteams.workspace.projection"]) return;

      const roomId = event.getRoomId();
      if (!roomId) return;
      const binding = await window.electron!.workspace.getBinding(roomId);
      if (!binding) return;
      const userId = client.getUserId();
      if (binding.boundBy !== userId) return;

      // ⭐ 剥离 <workspace_context> 区块，只在用户真实文字里检测路径
      const text = stripWorkspaceContext(content.body ?? "");

      const { nodes } = await window.electron!.workspace.scanTree(roomId);
      const treePaths = nodes.filter(n => !n.isDirectory).map(n => n.path);
      const detected = detectFilePaths(text, treePaths).slice(0, MAX_FILES_PER_MESSAGE);
      if (detected.length === 0) return;

      let roomMap = projected.current.get(roomId);
      if (!roomMap) { roomMap = new Map(); projected.current.set(roomId, roomMap); }

      for (const relPath of detected) {
        const result = await window.electron!.workspace.readFile(roomId, relPath);
        if (!result.ok) {
          // m.text 而非 m.notice：让 Agent 知道"想读但读不到"
          await client.sendEvent(roomId, "m.room.message", {
            msgtype: "m.text",
            body:
              `[工作区文件读取失败 · 系统消息] 路径 \`${relPath}\` 无法读取：${result.error}。\n` +
              `不要再次请求该文件，请基于已知信息继续回答。`,
            "com.agentteams.workspace.projection": { kind: "file_error", path: relPath },
          });
          continue;
        }
        if (roomMap.get(relPath) === result.mtime) continue;  // 去重
        roomMap.set(relPath, result.mtime!);

        if (result.isText && (result.size ?? 0) <= INLINE_SIZE_THRESHOLD) {
          // ⭐ 必须 m.text（m.notice 会被 Agent 忽略）
          // ⭐ body 必须重度 prompt engineering（见 §4.2.1），否则 Agent
          //   会把这条消息当作"路径预告"继续要求用户上传。
          await client.sendEvent(roomId, "m.room.message", {
            msgtype: "m.text",
            body:
              `📂 [工作区文件 · 自动注入] \`${relPath}\` (${fmtSize(result.size!)})\n` +
              `以下三个反引号之间是该文件的**完整内容**（系统已直接从用户磁盘读取）。` +
              `若用户随后询问这个文件、或你之前提到过这个路径，请直接基于以下内容回答，` +
              `**不要**再要求用户上传或提供路径：\n\n` +
              `\`\`\`${guessLang(relPath)}\n${result.content}\n\`\`\``,
            "com.agentteams.workspace.projection": {
              kind: "file", path: relPath, size: result.size, mtime: result.mtime,
            },
          });
        } else {
          const blob = result.isText
            ? new Blob([result.content!], { type: "text/plain" })
            : new Blob([Uint8Array.from(atob(result.base64!), c => c.charCodeAt(0))]);
          const filename = relPath.split("/").pop() ?? "file";
          const upload = await client.uploadContent(blob, { type: "application/octet-stream", name: filename });
          await client.sendEvent(roomId, "m.room.message", {
            msgtype: "m.file", body: filename, info: { size: result.size }, url: upload.content_uri,
            "com.agentteams.workspace.projection": {
              kind: "file", path: relPath, size: result.size, mtime: result.mtime,
            },
          });
        }
      }
    };

    client.on("Room.timeline", timelineHandler);
    return () => { unsubChange?.(); client.off("Room.timeline", timelineHandler); };
  }, []);

  return { sendWithContext };
}

// ===== 工具函数 =====
export function stripWorkspaceContext(body: string): string {
  const open = body.indexOf(CTX_OPEN);
  const close = body.indexOf(CTX_CLOSE);
  if (open === -1 || close === -1) return body;
  return (body.slice(0, open) + body.slice(close + CTX_CLOSE.length)).trim();
}

function detectFilePaths(text: string, treePaths: string[]): string[] {
  const found = new Set<string>();
  const pathSet = new Set(treePaths);
  const nameToPath = new Map<string, string[]>();
  for (const p of treePaths) {
    const base = p.split("/").pop()!;
    if (!nameToPath.has(base)) nameToPath.set(base, []);
    nameToPath.get(base)!.push(p);
  }
  let m;
  const bt = /`([^`\n]+)`/g;
  while ((m = bt.exec(text))) {
    const c = m[1].trim();
    if (pathSet.has(c)) found.add(c);
    else { const ms = nameToPath.get(c); if (ms?.length === 1) found.add(ms[0]); }
  }
  const af = /@file:([^\s]+)/g;
  while ((m = af.exec(text))) {
    const c = m[1].replace(/[.,;]$/, "");
    if (pathSet.has(c)) found.add(c);
  }
  const tokens = text.split(/[\s，。！？,!?、；：]+/);
  for (const tok of tokens) {
    const c = tok.replace(/^[("'「『【]+/, "").replace(/[)"'」』】.,;:!?]+$/, "");
    if (c.includes("/") && pathSet.has(c)) found.add(c);
    const ms = nameToPath.get(c);
    if (ms?.length === 1) found.add(ms[0]);
    if (["README.md", "package.json", "Cargo.toml", "go.mod"].includes(c) && pathSet.has(c)) found.add(c);
  }
  return Array.from(found);
}

function renderTree(nodes: { path: string; isDirectory: boolean }[]): string {
  return nodes.map(n => {
    const depth = n.path.split("/").length - 1;
    const indent = "  ".repeat(depth);
    const name = n.path.split("/").pop();
    return n.isDirectory ? `${indent}${name}/` : `${indent}${name}`;
  }).join("\n");
}
function exampleFile(nodes: { path: string; isDirectory: boolean }[]): string {
  const f = nodes.find(n => !n.isDirectory);
  return f ? f.path : "src/main.py";
}
function guessLang(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    py: "python", js: "javascript", ts: "typescript", tsx: "tsx", jsx: "jsx",
    rs: "rust", go: "go", java: "java", c: "c", cpp: "cpp", rb: "ruby", php: "php",
    sh: "bash", yaml: "yaml", yml: "yaml", json: "json", md: "markdown",
    html: "html", css: "css", sql: "sql", toml: "toml",
  };
  return map[ext] ?? "";
}
```

### 6.3 MessageComposer 集成

```tsx
// 用 sendWithContext 替换原来的 sendTextMessage
import { useWorkspaceInjection } from "@agentteams/ui/hooks";

export function MessageComposer({ roomId }: { roomId: string }) {
  const { sendWithContext } = useWorkspaceInjection();
  const [text, setText] = useState("");

  const handleSend = useCallback(async () => {
    if (!text.trim()) return;
    await sendWithContext(roomId, text);  // ⭐ 自动注入工作区上下文
    setText("");
  }, [roomId, text, sendWithContext]);
  // ... 其余不变
}
```

### 6.4 UI 隐藏注入的上下文

#### useTimeline：投影消息不参与发送者分组

投影消息的 sender 是绑定者（用户自己）。如果按"同 sender 同组"的常规规则分组，
紧跟投影后的用户消息会被吃成"延续"——视觉上头像和名字消失，看起来用户像是在
卡片"里面"说话。所以在 useTimeline 里要把投影事件视为"透明"：

```typescript
const isProjection = !!event.content[AGENTTEAMS_WORKSPACE.PROJECTION];
const sameGroup = event.sender === lastSender && event.timestamp - lastTs < 5*60*1000;

result.push({
  type: "message", event,
  showSender: isProjection ? false : !sameGroup,
  isOwn: event.sender === currentUserId,
});

if (!isProjection) {        // ⭐ 投影不更新 lastSender/lastTs
  lastSender = event.sender;
  lastTs = event.timestamp;
}
```

#### MessageBubble：用户消息截断 + 文件投影折叠

```tsx
import { stripWorkspaceContext } from "@agentteams/ui/hooks";

function MessageBubble({ event }: { event: any }) {
  const content = event.getContent();

  // 1. 文件投影消息 → 折叠卡片
  const projection = content["com.agentteams.workspace.projection"];
  if (projection) {
    if (projection.kind === "file") {
      return <WorkspaceFileCard path={projection.path} size={projection.size} rawBody={content.body} />;
    }
    if (projection.kind === "unbind") {
      return <div className="text-[11px] text-center" style={{ color: 'var(--text-tertiary)' }}>{content.body}</div>;
    }
    if (projection.kind === "file_error") {
      return <div className="text-[11px]" style={{ color: 'var(--color-danger)' }}>{content.body}</div>;
    }
  }

  // 2. 注入了工作区上下文的用户消息 → 截断只显示用户文字
  if (content["com.agentteams.workspace.injected"]) {
    const userText = stripWorkspaceContext(content.body ?? "");
    return (
      <DefaultMessageBubble event={event} overrideText={userText}
        badge={<WorkspaceContextBadge workspace={content["com.agentteams.workspace.injected"].workspace} />} />
    );
  }

  // 3. 普通消息
  return <DefaultMessageBubble event={event} />;
}
```

#### WorkspaceContextBadge（可选小标识）

在带工作区上下文的用户消息旁，显示一个小图标表示"这条消息携带了工作区上下文"，鼠标悬停可查看注入了什么：

```
帮我重构认证模块   📎 TestMagic
                  ↑ 悬停显示"已附带 TestMagic 目录树 + 项目说明"
```

#### WorkspaceFileCard（文件投影折叠卡片）

```tsx
function WorkspaceFileCard({ path, size, rawBody }: { path: string; size: number; rawBody: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg my-1 text-xs" style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border-default)' }}>
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 w-full px-3 py-2">
        <span>📄</span>
        <span className="font-mono">{path}</span>
        <span className="ml-auto" style={{ color: 'var(--text-tertiary)' }}>{fmtSize(size)}</span>
        <span>{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <pre className="px-3 pb-2 overflow-x-auto text-[11px]">{rawBody}</pre>
      )}
    </div>
  );
}
```

### 6.5 IPC + Preload

```typescript
// ipc/workspace.ts
ipcMain.handle("workspace:pickFolder", ...);
ipcMain.handle("workspace:bind", (_e, rid, p, by) => wm.bind(rid, p, by));
ipcMain.handle("workspace:unbind", (_e, rid) => wm.unbind(rid));
ipcMain.handle("workspace:getBinding", (_e, rid) => wm.getBinding(rid));
ipcMain.handle("workspace:scanTree", (_e, rid) => wm.scanTree(rid));
ipcMain.handle("workspace:getSystemContext", (_e, rid) => wm.getSystemContext(rid));
ipcMain.handle("workspace:setBindingContext", (_e, rid, ctx) => wm.setBindingContext(rid, ctx));
ipcMain.handle("workspace:getGlobalContext", () => wm.getGlobalContext());
ipcMain.handle("workspace:setGlobalContext", (_e, txt) => wm.setGlobalContext(txt));
ipcMain.handle("workspace:readFile", (_e, rid, p) => wm.readFile(rid, p));
ipcMain.handle("workspace:revealInFinder", (_e, rid) => wm.revealInFinder(rid));

// main/index.ts
const wm = new WorkspaceManager((roomId, binding, kind) => {
  BrowserWindow.getAllWindows().forEach(w =>
    w.webContents.send("workspace:change", { roomId, binding, kind }));
});
await wm.load();
app.on("before-quit", () => wm.shutdown());

// preload
workspace: {
  pickFolder: () => ipcRenderer.invoke("workspace:pickFolder"),
  bind: (rid, p, by) => ipcRenderer.invoke("workspace:bind", rid, p, by),
  unbind: (rid) => ipcRenderer.invoke("workspace:unbind", rid),
  getBinding: (rid) => ipcRenderer.invoke("workspace:getBinding", rid),
  scanTree: (rid) => ipcRenderer.invoke("workspace:scanTree", rid),
  getSystemContext: (rid) => ipcRenderer.invoke("workspace:getSystemContext", rid),
  setBindingContext: (rid, ctx) => ipcRenderer.invoke("workspace:setBindingContext", rid, ctx),
  getGlobalContext: () => ipcRenderer.invoke("workspace:getGlobalContext"),
  setGlobalContext: (txt) => ipcRenderer.invoke("workspace:setGlobalContext", txt),
  readFile: (rid, p) => ipcRenderer.invoke("workspace:readFile", rid, p),
  revealInFinder: (rid) => ipcRenderer.invoke("workspace:revealInFinder", rid),
  onChange: (h) => { ipcRenderer.on("workspace:change", h); return () => ipcRenderer.removeListener("workspace:change", h); },
}
```

---

## 7. UI/UX

### 7.1 绑定流程

```
[+] → "绑定本地工作区" → 原生选择器 → 选目录 → 确认框：

┌──────────────────────────────────────────┐
│ 绑定本地工作区到此对话？                  │
├──────────────────────────────────────────┤
│ 📁 TestMagic                             │
│ /Users/jacefu/TestMagic                  │
│                                          │
│ 工作方式：                                │
│ ✓ 你每次发消息时，目录结构会作为上下文     │
│   自动附带给 Agent（你看不到，聊天区干净） │
│ ✓ 你或 Agent 提到某文件路径，该文件内容    │
│   会自动提供                              │
│ ✓ 文件保留在你电脑上                      │
│ ✓ 可在设置里给这个绑定填项目说明，         │
│   会一起附带给 Agent（不碰你的文件夹）     │
│ ✓ 自动排除 .env / .ssh / node_modules     │
│                                          │
│ ☐ 我理解上述说明                          │
│            [取消]  [绑定]                  │
└──────────────────────────────────────────┘
```

### 7.2 ChannelHeader 指示 + 设置面板

- ChannelHeader：`📁 TestMagic`（绑定中）
- WorkspaceSection（设置面板）：
  - 已绑定路径、[打开本地文件夹]、[解除绑定]
  - **本绑定专属说明**：一个文本框，填这个文件夹专属的项目说明，调 `setBindingContext` 存到 `~/.agentteams/workspaces.json`
- 全局设置页：**全局系统提示词**编辑器（编辑 `~/.agentteams/agentteams.md`，调 `getGlobalContext` / `setGlobalContext`），所有对话都会带上

---

## 8. 安全性

- **路径越界**：`resolveSafe()` 双重校验
- **忽略列表**：默认 + `~/.agentteams/ignore`（全局）；`.env` / `.ssh` / `id_rsa` 等不进树、不可读
- **大小限制**：单文件 5MB；context 8KB；单消息最多投影 3 个文件
- **不污染用户目录**：所有配置在 `~/.agentteams/`，绝不往用户绑定的文件夹写文件
- **E2EE**：加密房间中注入内容/投影消息被 Megolm 加密
- **隐私告知**：绑定确认框明示"目录与文件内容会作为上下文附带给 Agent"

---

## 9. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 群聊/私聊都能"绑定本地工作区"，只选目录不选文件 | 操作验证 |
| AC-2 | **绑定后用户发消息，实际发出的 body 含 `<workspace_context>` 区块（目录树）** ⭐ | Element Web 查 raw |
| AC-3 | **用户在 AgentTeams UI 只看到自己的文字，看不到 workspace_context 区块** ⭐ | 视觉检查 |
| AC-4 | `~/.agentteams/agentteams.md`（全局）有内容时，其内容出现在注入的 body 里 | 创建该文件验证 |
| AC-4b | 给某绑定填了专属说明（App 设置）后，该说明出现在注入的 body 里 | 设置后查 raw |
| AC-5 | **Agent 基于目录树/项目说明回答，无需用户解释项目** ⭐ | 实测对话 |
| AC-6 | **Agent 回复提到 `src/auth.py` 后，对话出现该文件内容投影** ⭐ | 实测 |
| AC-7 | 用户消息提到文件路径同样触发投影 | 实测 |
| AC-8 | **端到端：绑定后问"重构认证"，Agent 知道结构→提文件→内容出现→基于内容回答** ⭐⭐ | 端到端实测 |
| AC-9 | **不死循环**（注入消息/投影消息不触发再次投影） ⭐ | 观察是否刷屏 |
| AC-10 | `<workspace_context>` 区块内的路径不触发文件投影（只检测用户真实文字） | 验证 |
| AC-11 | 同文件未改不重复投影；改了（mtime 变）重新投影 | 实测 |
| AC-12 | 文件投影 UI 折叠成卡片，可展开 | 视觉检查 |
| AC-13 | 路径越界 / `.env` 等敏感文件不投影、不进树 | 故意构造 |
| AC-14 | 大文件（>50KB）走 m.file 附件 | 验证 |
| AC-15 | 目录文件增删后，下一条用户消息注入的树是最新的 | 增删后发消息验证 |
| AC-16 | 绑定关系存在 `~/.agentteams/workspaces.json`，绝不在用户绑定的文件夹里产生文件 | 检查 ~/.agentteams + 用户文件夹 |
| AC-17 | 重启应用后绑定恢复 | 重启验证 |
| AC-18 | `pnpm typecheck && pnpm build` 通过 | 命令验证 |

---

## 10. 实现任务

### 任务 1：Main 进程 WorkspaceManager + IgnoreEngine
创建 `WorkspaceManager.ts`（§6.1，含 scanTree / getSystemContext / setBindingContext / getGlobalContext / setGlobalContext / readFile，存储用 `~/.agentteams/`）、`IgnoreEngine.ts`、`ipc/workspace.ts`
修改 `main/index.ts` 初始化 + before-quit
依赖：`pnpm add chokidar minimatch -F @agentteams/desktop`
验证：`pnpm typecheck`

### 任务 2：Preload
按 §6.5 暴露 workspace API（含 getSystemContext / setBindingContext / getGlobalContext / setGlobalContext）
验证：`pnpm typecheck`

### 任务 3：useWorkspaceInjection（核心）
创建 `packages/ui/src/hooks/useWorkspaceInjection.ts`（§6.2）
⚠️ 重点：sendWithContext 注入逻辑 + stripWorkspaceContext + 防循环 + 去重
导出 stripWorkspaceContext（UI 也要用）
验证：`pnpm typecheck`

### 任务 4：MessageComposer 集成
按 §6.3 用 sendWithContext 替换 sendTextMessage
验证：`pnpm typecheck && pnpm dev:desktop`

### 任务 5：UI 隐藏逻辑
按 §6.4 修改 MessageBubble：
- 注入消息 → stripWorkspaceContext 截断显示
- 文件投影 → WorkspaceFileCard 折叠
创建 WorkspaceFileCard、WorkspaceContextBadge
验证：`pnpm typecheck`

### 任务 6：绑定 UI
创建 BindWorkspaceButton、BindWorkspaceConfirmDialog（§7.1）+ 集成到 + 菜单
验证：`pnpm typecheck`

### 任务 7：ChannelHeader + 设置面板
创建 WorkspaceIndicator、WorkspaceSection（含本绑定专属说明编辑框 → setBindingContext）+ 集成
在全局设置页加"全局系统提示词"编辑器（getGlobalContext / setGlobalContext，编辑 `~/.agentteams/agentteams.md`）
验证：`pnpm typecheck`

### 任务 8：全局验证
```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm dev:desktop
```
**重点验证 AC-2/AC-3（body 含上下文但 UI 不显示）、AC-8（端到端）、AC-9（无死循环）**
用 Element Web 查 raw 消息确认 body 含 `<workspace_context>` 区块。
提交：`git commit -m "feat: 022 v6 - workspace context injection into message body"`

---

## 11. 关于 Agent 侧

**Agent 零改造**。上下文在消息 body 里，Agent 读 body（它本来就这么读）就拿到了。

唯一的隐性依赖：Agent 收到房间新消息（包括文件投影消息）后会继续回复——大多数持续监听房间的 Agent 天然如此。流程：

```
Agent 说"我看下 src/auth.py" → 客户端投影文件内容（新消息）
  → Agent 收到新消息 → 读 body 拿到内容 → 继续分析
```

---

## 12. 存储模型 + v6 要点总结

```
全局配置  → ~/.agentteams/（Mac App 全局，用户主目录，好找）
            ├── workspaces.json   绑定关系 + 每绑定专属说明
            ├── ignore            全局排除规则
            └── agentteams.md     全局系统提示词（所有对话都带）
目录树    → 实时扫描 + 内存缓存（不落盘）
用户文件夹 → 完全不碰，不写任何文件 ⭐

注入到每条用户消息 body 的"系统提示词" =
   目录树（实时）
 + ~/.agentteams/agentteams.md（全局）
 + 该绑定专属说明（App 设置里填，存 workspaces.json）
 + 固定提示
   全部包在 <workspace_context> 区块里，Agent 读 body 自动拿到，UI 截断隐藏
```