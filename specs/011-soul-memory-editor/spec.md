# Spec 011: SOUL/MEMORY 编辑器（Soul Memory Editor）

> 优先级: P2 | 波次: Wave 3 | 预估: 2-3 天 | 前置依赖: 002-matrix-sdk-wrapper, 010-agent-status-dashboard

---

## 1. 目标

集成 Monaco Editor，为用户提供 SOUL.md（Agent 人格定义）和 MEMORY.md（Agent 记忆）的在线编辑能力。编辑内容通过 Magic 自定义 Matrix State Event 持久化到房间状态中，支持版本查看和差异对比。完成后，用户可以在右侧面板中直接编辑 Agent 的 SOUL 和 MEMORY 文件，保存后即时生效。

### 用户故事

- 作为用户，我希望在 Agent 面板中切换到"SOUL/MEMORY"标签，看到当前房间的 SOUL.md 和 MEMORY.md 内容
- 作为用户，我希望使用功能丰富的代码编辑器（语法高亮、行号、小地图、自动换行）编辑 Markdown 内容
- 作为用户，我希望编辑后点击"保存"将内容持久化到 Matrix 房间状态
- 作为用户，我希望看到上次编辑者和编辑时间
- 作为用户，我希望保存前可以预览与当前版本的差异（Diff 视图）
- 作为用户，我希望切换 SOUL 和 MEMORY 两个文件时编辑器内容正确切换
- 作为用户，我希望编辑器主题与应用整体暗色主题一致

### 非目标（本 spec 不实现）

- SOUL/MEMORY 的版本历史列表 —— 后续 spec（需要 Matrix room history 查询）
- 多人协同编辑（实时光标同步）—— 后续 spec
- SOUL/MEMORY 模板库 —— 后续 spec

---

## 2. 架构设计

### 2.1 数据存储

SOUL.md 和 MEMORY.md 的内容存储为 Matrix State Events：

| 事件类型 | state_key | 内容 |
|---------|-----------|------|
| `com.magic.soul.content` | `""` | `{ content, file_type: "soul", version, editor }` |
| `com.magic.memory.content` | `""` | `{ content, file_type: "memory", version, editor }` |

每个房间只保留一份 SOUL 和一份 MEMORY（state_key 为空字符串），新保存覆盖旧内容。Matrix State Event 天然保留最新版本，历史版本可通过 room timeline 回溯。

### 2.2 组件结构

```
packages/ui/src/
├── editors/
│   ├── SoulMemoryEditor.tsx       # 编辑器容器（标签切换 + 编辑器 + 工具栏）
│   ├── MonacoWrapper.tsx          # Monaco Editor 封装
│   ├── EditorToolbar.tsx          # 工具栏（保存、Diff、文件切换）
│   ├── DiffViewer.tsx             # Diff 对比视图
│   └── EditorMeta.tsx             # 元信息（编辑者、时间、版本号）
├── hooks/
│   └── useSoulMemory.ts           # SOUL/MEMORY 数据读写 hook
└── agents/
    └── AgentDashboard.tsx         # 更新：增加第四标签
```

---

## 3. 技术规格

### 3.1 依赖安装

在 `packages/ui/` 中：
```bash
pnpm add @monaco-editor/react@^4.7.0 monaco-editor@^0.52.0
```

> Electron 中必须本地打包 Monaco（通过 `loader.config({ monaco })`），不使用 CDN。

### 3.2 useSoulMemory.ts — 数据读写 Hook

```typescript
// packages/ui/src/hooks/useSoulMemory.ts
import { useState, useEffect, useCallback, useRef } from "react";
import {
  getSoulContent,
  sendSoulContent,
  useAuthStore,
} from "@magic/matrix-client";
import type { SoulContentEvent } from "@magic/shared-types";

interface UseSoulMemoryOptions {
  roomId: string;
  fileType: "soul" | "memory";
}

interface SoulMemoryState {
  /** 服务端最新内容 */
  savedContent: string;
  /** 编辑器当前内容 */
  editContent: string;
  /** 元信息 */
  meta: {
    version: number;
    editor: string;
    lastSaved: number | null;
  };
  /** 是否有未保存的修改 */
  isDirty: boolean;
  /** 正在保存 */
  isSaving: boolean;
  /** 正在加载 */
  isLoading: boolean;
  /** 错误 */
  error: string | null;
}

export function useSoulMemory({ roomId, fileType }: UseSoulMemoryOptions) {
  const userId = useAuthStore((s) => s.userId);
  const [state, setState] = useState<SoulMemoryState>({
    savedContent: "",
    editContent: "",
    meta: { version: 0, editor: "", lastSaved: null },
    isDirty: false,
    isSaving: false,
    isLoading: true,
    error: null,
  });

  // 加载内容
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, isLoading: true, error: null }));

    const data = getSoulContent(roomId, fileType);

    if (!cancelled) {
      if (data) {
        setState({
          savedContent: data.content,
          editContent: data.content,
          meta: {
            version: data.version,
            editor: data.editor,
            lastSaved: Date.now(), // 近似
          },
          isDirty: false,
          isSaving: false,
          isLoading: false,
          error: null,
        });
      } else {
        const defaultContent = fileType === "soul"
          ? getDefaultSoul()
          : getDefaultMemory();
        setState({
          savedContent: "",
          editContent: defaultContent,
          meta: { version: 0, editor: "", lastSaved: null },
          isDirty: true,
          isSaving: false,
          isLoading: false,
          error: null,
        });
      }
    }

    return () => { cancelled = true; };
  }, [roomId, fileType]);

  // 编辑内容变化
  const setEditContent = useCallback((content: string) => {
    setState((s) => ({
      ...s,
      editContent: content,
      isDirty: content !== s.savedContent,
    }));
  }, []);

  // 保存
  const save = useCallback(async () => {
    if (!userId) return;

    setState((s) => ({ ...s, isSaving: true, error: null }));

    try {
      const newVersion = state.meta.version + 1;
      await sendSoulContent(roomId, {
        content: state.editContent,
        file_type: fileType,
        version: newVersion,
        editor: userId,
      });

      setState((s) => ({
        ...s,
        savedContent: s.editContent,
        meta: {
          version: newVersion,
          editor: userId,
          lastSaved: Date.now(),
        },
        isDirty: false,
        isSaving: false,
      }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        isSaving: false,
        error: err.message ?? "保存失败",
      }));
    }
  }, [roomId, fileType, userId, state.editContent, state.meta.version]);

  // 恢复到保存版本
  const revert = useCallback(() => {
    setState((s) => ({
      ...s,
      editContent: s.savedContent,
      isDirty: false,
    }));
  }, []);

  return {
    ...state,
    setEditContent,
    save,
    revert,
  };
}

function getDefaultSoul(): string {
  return `# SOUL.md

## 身份
你是一个专业的 AI 助手。

## 目标
帮助用户高效完成任务。

## 原则
- 准确、简洁、有帮助
- 主动沟通进展和问题
- 遵守安全和隐私规范
`;
}

function getDefaultMemory(): string {
  return `# MEMORY.md

## 项目上下文
（在此记录项目相关的长期记忆）

## 用户偏好
（在此记录用户的工作习惯和偏好）

## 历史决策
（在此记录重要的技术和业务决策）
`;
}
```

### 3.3 MonacoWrapper.tsx — Monaco 编辑器封装

```tsx
// packages/ui/src/editors/MonacoWrapper.tsx
import { useRef, useCallback } from "react";
import Editor, { loader, type OnMount, type OnChange } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

// Electron 环境本地加载 Monaco（不使用 CDN）
loader.config({ monaco });

interface MonacoWrapperProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string | number;
}

export function MonacoWrapper({
  value,
  onChange,
  language = "markdown",
  readOnly = false,
  height = "100%",
}: MonacoWrapperProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor;

    // 自定义 Magic 暗色主题
    monacoInstance.editor.defineTheme("magic-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6b7280" },
        { token: "keyword", foreground: "818cf8" },
        { token: "string", foreground: "34d399" },
      ],
      colors: {
        "editor.background": "#111827",
        "editor.foreground": "#e5e7eb",
        "editor.lineHighlightBackground": "#1f2937",
        "editor.selectionBackground": "#2563eb40",
        "editorCursor.foreground": "#3b82f6",
        "editorGutter.background": "#111827",
        "editorLineNumber.foreground": "#4b5563",
        "editorLineNumber.activeForeground": "#9ca3af",
        "editor.inactiveSelectionBackground": "#1e40af30",
      },
    });

    monacoInstance.editor.setTheme("magic-dark");

    // 快捷键：Ctrl+S / Cmd+S 保存
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => {
        // 触发自定义保存事件
        const event = new CustomEvent("magic:editor-save");
        window.dispatchEvent(event);
      },
    );
  }, []);

  const handleChange: OnChange = useCallback((newValue) => {
    onChange(newValue ?? "");
  }, [onChange]);

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={handleChange}
      onMount={handleMount}
      theme="magic-dark"
      options={{
        minimap: { enabled: true, size: "proportional" },
        wordWrap: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineHeight: 20,
        padding: { top: 12, bottom: 12 },
        readOnly,
        tabSize: 2,
        renderLineHighlight: "line",
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        bracketPairColorization: { enabled: true },
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
      loading={
        <div className="flex h-full items-center justify-center bg-magic-surface">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
        </div>
      }
    />
  );
}
```

### 3.4 DiffViewer.tsx — Diff 对比视图

```tsx
// packages/ui/src/editors/DiffViewer.tsx
import { useRef, useCallback } from "react";
import { DiffEditor, loader, type DiffOnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

loader.config({ monaco });

interface DiffViewerProps {
  original: string;
  modified: string;
  language?: string;
  height?: string | number;
}

export function DiffViewer({
  original,
  modified,
  language = "markdown",
  height = "100%",
}: DiffViewerProps) {
  const handleMount: DiffOnMount = useCallback((editor) => {
    // 应用 magic-dark 主题（已在 MonacoWrapper 中定义）
  }, []);

  return (
    <DiffEditor
      height={height}
      language={language}
      original={original}
      modified={modified}
      onMount={handleMount}
      theme="magic-dark"
      options={{
        readOnly: true,
        renderSideBySide: true,
        minimap: { enabled: false },
        wordWrap: "on",
        fontSize: 12,
        lineHeight: 18,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
      loading={
        <div className="flex h-full items-center justify-center bg-magic-surface">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
        </div>
      }
    />
  );
}
```

### 3.5 EditorMeta.tsx — 元信息显示

```tsx
// packages/ui/src/editors/EditorMeta.tsx

interface EditorMetaProps {
  version: number;
  editor: string;
  lastSaved: number | null;
}

export function EditorMeta({ version, editor, lastSaved }: EditorMetaProps) {
  if (version === 0) {
    return (
      <p className="text-xs text-gray-600">尚未保存过</p>
    );
  }

  const editorName = editor.match(/^@([^:]+)/)?.[1] ?? editor;
  const timeStr = lastSaved ? formatTime(lastSaved) : "未知";

  return (
    <p className="text-xs text-gray-500">
      v{version} · {editorName} 于 {timeStr} 编辑
    </p>
  );
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - ts;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  if (date.toDateString() === now.toDateString()) {
    return `今天 ${hours}:${minutes}`;
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
}
```

### 3.6 EditorToolbar.tsx — 工具栏

```tsx
// packages/ui/src/editors/EditorToolbar.tsx

interface EditorToolbarProps {
  fileType: "soul" | "memory";
  onFileTypeChange: (type: "soul" | "memory") => void;
  isDirty: boolean;
  isSaving: boolean;
  showDiff: boolean;
  onToggleDiff: () => void;
  onSave: () => void;
  onRevert: () => void;
}

export function EditorToolbar({
  fileType,
  onFileTypeChange,
  isDirty,
  isSaving,
  showDiff,
  onToggleDiff,
  onSave,
  onRevert,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
      {/* 文件切换 */}
      <div className="flex rounded-lg bg-magic-surface p-0.5">
        <button
          onClick={() => onFileTypeChange("soul")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            fileType === "soul"
              ? "bg-magic-primary text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          SOUL.md
        </button>
        <button
          onClick={() => onFileTypeChange("memory")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            fileType === "memory"
              ? "bg-magic-primary text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          MEMORY.md
        </button>
      </div>

      <div className="flex-1" />

      {/* Diff 切换 */}
      {isDirty && (
        <button
          onClick={onToggleDiff}
          className={`rounded px-2 py-1 text-xs transition-colors ${
            showDiff
              ? "bg-magic-primary/20 text-magic-primary"
              : "text-gray-400 hover:text-gray-200"
          }`}
          title="查看差异"
        >
          Diff
        </button>
      )}

      {/* 恢复 */}
      {isDirty && (
        <button
          onClick={onRevert}
          className="rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          title="放弃修改"
        >
          恢复
        </button>
      )}

      {/* 保存 */}
      <button
        onClick={onSave}
        disabled={!isDirty || isSaving}
        className="rounded-lg bg-magic-primary px-3 py-1 text-xs font-medium text-white
                   hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isSaving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
```

### 3.7 SoulMemoryEditor.tsx — 编辑器容器

```tsx
// packages/ui/src/editors/SoulMemoryEditor.tsx
import { useState, useEffect, useCallback } from "react";
import { useSoulMemory } from "../hooks/useSoulMemory";
import { MonacoWrapper } from "./MonacoWrapper";
import { DiffViewer } from "./DiffViewer";
import { EditorToolbar } from "./EditorToolbar";
import { EditorMeta } from "./EditorMeta";

interface SoulMemoryEditorProps {
  roomId: string;
}

export function SoulMemoryEditor({ roomId }: SoulMemoryEditorProps) {
  const [fileType, setFileType] = useState<"soul" | "memory">("soul");
  const [showDiff, setShowDiff] = useState(false);

  const {
    savedContent,
    editContent,
    meta,
    isDirty,
    isSaving,
    isLoading,
    error,
    setEditContent,
    save,
    revert,
  } = useSoulMemory({ roomId, fileType });

  // 切换文件时关闭 diff
  useEffect(() => {
    setShowDiff(false);
  }, [fileType]);

  // 监听 Ctrl+S 快捷键
  useEffect(() => {
    const handler = () => {
      if (isDirty && !isSaving) save();
    };
    window.addEventListener("magic:editor-save", handler);
    return () => window.removeEventListener("magic:editor-save", handler);
  }, [isDirty, isSaving, save]);

  const handleFileTypeChange = useCallback((type: "soul" | "memory") => {
    // 未保存修改时提示
    if (isDirty) {
      const confirm = window.confirm("当前有未保存的修改，是否放弃？");
      if (!confirm) return;
    }
    setFileType(type);
  }, [isDirty]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <EditorToolbar
        fileType={fileType}
        onFileTypeChange={handleFileTypeChange}
        isDirty={isDirty}
        isSaving={isSaving}
        showDiff={showDiff}
        onToggleDiff={() => setShowDiff(!showDiff)}
        onSave={save}
        onRevert={revert}
      />

      {/* 编辑器 / Diff 视图 */}
      <div className="flex-1 min-h-0">
        {showDiff ? (
          <DiffViewer
            original={savedContent}
            modified={editContent}
          />
        ) : (
          <MonacoWrapper
            value={editContent}
            onChange={setEditContent}
          />
        )}
      </div>

      {/* 底部元信息 */}
      <div className="flex items-center justify-between border-t border-gray-800 px-3 py-1.5">
        <EditorMeta
          version={meta.version}
          editor={meta.editor}
          lastSaved={meta.lastSaved}
        />
        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
        {isDirty && (
          <span className="text-xs text-yellow-500">● 未保存</span>
        )}
      </div>
    </div>
  );
}
```

### 3.8 更新 AgentDashboard.tsx — 增加第四标签

```tsx
// packages/ui/src/agents/AgentDashboard.tsx（更新）
import { SoulMemoryEditor } from "../editors/SoulMemoryEditor";

// tabs 数组追加：
const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "agents", label: "Agent 状态" },
  { key: "tasks", label: "任务看板" },
  { key: "graph", label: "协作图" },
  { key: "soul", label: "SOUL/MEMORY" },  // 新增
];

type TabKey = "agents" | "tasks" | "graph" | "soul";

// 内容区追加：
{activeTab === "soul" && <SoulMemoryEditor roomId={roomId} />}
```

### 3.9 更新 @magic/ui 导出

追加到 `packages/ui/src/index.ts`：

```typescript
// Editors
export { SoulMemoryEditor } from "./editors/SoulMemoryEditor";
export { MonacoWrapper } from "./editors/MonacoWrapper";
export { DiffViewer } from "./editors/DiffViewer";
export { EditorToolbar } from "./editors/EditorToolbar";
export { EditorMeta } from "./editors/EditorMeta";

// Hooks
export { useSoulMemory } from "./hooks/useSoulMemory";
```

---

## 4. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | Agent 面板中出现第四标签"SOUL/MEMORY" | 视觉检查 |
| AC-2 | 切换到该标签后显示 Monaco 编辑器，默认加载 SOUL.md | 视觉检查 |
| AC-3 | 编辑器有 Markdown 语法高亮、行号、小地图、自动换行 | 视觉检查 |
| AC-4 | 编辑器主题与应用暗色主题一致（magic-dark） | 视觉检查 |
| AC-5 | 修改内容后底部显示"● 未保存"黄色提示 | 手动验证 |
| AC-6 | 点击"保存"后内容写入 Matrix State Event，成功后"未保存"消失 | DevTools 检查事件 |
| AC-7 | Ctrl+S / Cmd+S 快捷键触发保存 | 手动验证 |
| AC-8 | 点击"Diff"按钮显示左右对比视图（已保存 vs 当前编辑） | 手动验证 |
| AC-9 | 点击"恢复"按钮回退到已保存版本 | 手动验证 |
| AC-10 | 切换 SOUL.md ↔ MEMORY.md 时内容正确切换 | 手动验证 |
| AC-11 | 有未保存修改时切换文件弹出确认对话框 | 手动验证 |
| AC-12 | 底部显示版本号、编辑者、编辑时间 | 视觉检查 |
| AC-13 | 首次无内容时显示默认模板 | 新房间中查看 |
| AC-14 | `pnpm typecheck` 全局通过 | `pnpm typecheck` |
| AC-15 | `pnpm test` 所有测试通过 | `pnpm test` |

---

## 5. 实现任务（按执行顺序）

### 任务 1：安装 Monaco Editor 依赖

```bash
cd packages/ui && pnpm add @monaco-editor/react@^4.7.0 monaco-editor@^0.52.0
```

**验证**：`pnpm install`

---

### 任务 2：创建 useSoulMemory Hook

**创建文件**：`packages/ui/src/hooks/useSoulMemory.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：创建 MonacoWrapper 组件

**创建文件**：`packages/ui/src/editors/MonacoWrapper.tsx`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 DiffViewer 组件

**创建文件**：`packages/ui/src/editors/DiffViewer.tsx`

**验证**：`pnpm typecheck`

---

### 任务 5：创建 EditorMeta 和 EditorToolbar

**创建文件**：
- `packages/ui/src/editors/EditorMeta.tsx`
- `packages/ui/src/editors/EditorToolbar.tsx`

**验证**：`pnpm typecheck`

---

### 任务 6：创建 SoulMemoryEditor 容器

**创建文件**：`packages/ui/src/editors/SoulMemoryEditor.tsx`

**验证**：`pnpm typecheck`

---

### 任务 7：更新 AgentDashboard 增加第四标签

**修改文件**：`packages/ui/src/agents/AgentDashboard.tsx`

**验证**：`pnpm dev:desktop`（Agent 面板显示 SOUL/MEMORY 标签）

---

### 任务 8：更新 @magic/ui 导出

**修改文件**：`packages/ui/src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 9：编写单元测试

**创建文件**：
- `packages/ui/__tests__/hooks/useSoulMemory.test.ts` — 加载/保存/恢复/dirty 状态
- `packages/ui/__tests__/editors/EditorToolbar.test.tsx` — 按钮状态、文件切换

**验证**：`pnpm test`

---

### 任务 10：全局集成验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # Agent 面板 → SOUL/MEMORY 标签 → 编辑 → 保存 → Diff
```

完成后提交：
```bash
git add -A
git commit -m "feat: 011 - SOUL/MEMORY editor with Monaco, diff view, version tracking"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Monaco Editor 包体积大（~5MB） | 首屏加载慢 | 通过 `React.lazy()` 延迟加载 SoulMemoryEditor 组件 |
| Monaco 每个实例约 30-50MB 内存 | 内存压力 | 切换标签时卸载编辑器（`key={fileType}` 强制重建），同时最多一个编辑器 |
| Electron 离线环境加载 Monaco Worker | Worker 加载失败 | `loader.config({ monaco })` 本地打包，不依赖 CDN |
| State Event 覆盖写入无冲突检测 | 多人同时编辑覆盖 | 当前版本号检查——如果保存时版本不匹配则提示用户 |
| `window.confirm()` 在某些 Electron 配置下不工作 | 切换文件确认失败 | 后续替换为自定义 DialogOverlay 确认弹窗 |

---

## 7. 后续 Spec 的接入点

- **后续版本历史 spec**：通过 Matrix room timeline 查询 `com.magic.soul.content` 的历史事件，在编辑器中提供版本列表和回滚
- **后续协同编辑 spec**：通过 Matrix Typing 或自定义事件实现光标同步
- **后续模板库 spec**：提供预设的 SOUL/MEMORY 模板，一键填充
- **后续独立编辑器视图 spec**：将编辑器从右侧面板提取为全屏视图，支持更大编辑空间