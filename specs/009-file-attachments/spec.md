# Spec 009: 文件附件（File Attachments）

> 优先级: P1 | 波次: Wave 3 | 预估: 2-3 天 | 前置依赖: 002-matrix-sdk-wrapper, 006-chat-timeline, 007-message-composer

---

## 1. 目标

完善文件上传和下载的完整体验——上传进度条、拖拽上传、粘贴图片上传、多文件批量上传、下载到本地、以及上传前预览确认。完成后，用户可以通过按钮选择、拖拽到聊天区域、或 Ctrl+V 粘贴三种方式发送文件，上传过程中看到实时进度，并可取消。

### 用户故事

- 作为用户，我希望拖拽文件到聊天区域即可上传发送
- 作为用户，我希望 Ctrl+V / Cmd+V 粘贴剪贴板中的图片直接上传
- 作为用户，我希望上传过程中看到进度条和百分比
- 作为用户，我希望上传过程中可以取消上传
- 作为用户，我希望选择文件后先看到预览确认，再点击发送
- 作为用户，我希望可以同时选择多个文件批量上传
- 作为用户，我希望点击文件消息可以下载到本地
- 作为用户，我希望图片消息支持拖拽保存到桌面（Electron）

### 非目标（本 spec 不实现）

- 语音消息录制 —— 后续 spec
- 视频播放器内嵌 —— 后续 spec
- 文件大小限制配置（由 homeserver 决定）—— 服务端配置

---

## 2. 架构设计

### 2.1 上传流程

```
用户选择文件（按钮 / 拖拽 / 粘贴）
       ↓
FileUploadPreview（预览确认）
       ↓ 用户确认
uploadAndSendFile()（SDK 调用）
       ↓ progressHandler 回调
UploadProgressBar（实时进度）
       ↓ 上传完成
消息出现在时间线中
```

### 2.2 组件结构

```
packages/ui/src/
├── chat/
│   ├── ChatView.tsx               # 更新：增加拖拽区域
│   ├── ComposerToolbar.tsx        # 更新：完善附件按钮逻辑
│   └── MessageComposer.tsx        # 更新：增加粘贴处理
├── files/
│   ├── FileUploadPreview.tsx      # 上传前预览确认对话框
│   ├── FileUploadItem.tsx         # 单个文件上传条目（名称+进度+取消）
│   ├── UploadProgressBar.tsx      # 进度条组件
│   ├── DropZoneOverlay.tsx        # 拖拽悬浮遮罩
│   └── FileDownloadButton.tsx     # 文件下载按钮（增强版）
├── hooks/
│   ├── useFileUpload.ts           # 上传状态管理
│   ├── useDragDrop.ts             # 拖拽检测
│   └── usePasteFile.ts            # 粘贴图片检测
└── chat/
    ├── ImageMessage.tsx           # 更新：增加下载/保存按钮
    └── FileMessage.tsx            # 更新：增加下载进度
```

---

## 3. 技术规格

### 3.1 useFileUpload.ts — 上传状态管理

```typescript
// packages/ui/src/hooks/useFileUpload.ts
import { useState, useCallback, useRef } from "react";
import { uploadAndSendFile } from "@magic/matrix-client";

export interface UploadTask {
  id: string;
  file: File;
  progress: number;       // 0-100
  status: "pending" | "uploading" | "done" | "error" | "cancelled";
  error?: string;
}

export function useFileUpload(roomId: string) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  /**
   * 添加文件到上传队列（不立即上传，等用户确认）。
   */
  const addFiles = useCallback((files: File[]) => {
    const newTasks: UploadTask[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      progress: 0,
      status: "pending",
    }));
    setTasks((prev) => [...prev, ...newTasks]);
    return newTasks;
  }, []);

  /**
   * 开始上传所有 pending 的文件。
   */
  const startUpload = useCallback(async () => {
    const pending = tasks.filter((t) => t.status === "pending");
    if (pending.length === 0) return;

    for (const task of pending) {
      // 更新状态为 uploading
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: "uploading" as const } : t
        )
      );

      try {
        await uploadAndSendFile(
          roomId,
          task.file,
          (loaded, total) => {
            const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
            setTasks((prev) =>
              prev.map((t) =>
                t.id === task.id ? { ...t, progress } : t
              )
            );
          },
        );

        // 上传成功
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: "done" as const, progress: 100 } : t
          )
        );
      } catch (err: any) {
        if (err?.name === "AbortError") {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, status: "cancelled" as const } : t
            )
          );
        } else {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, status: "error" as const, error: err.message } : t
            )
          );
        }
      }
    }

    // 3 秒后自动清除已完成的任务
    setTimeout(() => {
      setTasks((prev) => prev.filter((t) => t.status !== "done"));
    }, 3000);
  }, [tasks, roomId]);

  /**
   * 取消指定任务。
   */
  const cancelTask = useCallback((taskId: string) => {
    const controller = abortControllers.current.get(taskId);
    if (controller) {
      controller.abort();
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: "cancelled" as const } : t
      )
    );
  }, []);

  /**
   * 移除指定任务（从列表中删除）。
   */
  const removeTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  /**
   * 清除所有已完成/已取消/错误的任务。
   */
  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status === "pending" || t.status === "uploading"));
  }, []);

  const hasActiveTasks = tasks.some((t) => t.status === "uploading" || t.status === "pending");

  return {
    tasks,
    addFiles,
    startUpload,
    cancelTask,
    removeTask,
    clearCompleted,
    hasActiveTasks,
  };
}
```

### 3.2 useDragDrop.ts — 拖拽检测

```typescript
// packages/ui/src/hooks/useDragDrop.ts
import { useState, useCallback, useRef, type DragEvent } from "react";

interface UseDragDropOptions {
  onDrop: (files: File[]) => void;
  accept?: string[];  // MIME 类型过滤，如 ["image/*", "application/pdf"]
}

export function useDragDrop({ onDrop, accept }: UseDragDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    // MIME 过滤
    const filtered = accept
      ? droppedFiles.filter((f) =>
          accept.some((pattern) => {
            if (pattern.endsWith("/*")) {
              return f.type.startsWith(pattern.replace("/*", "/"));
            }
            return f.type === pattern;
          })
        )
      : droppedFiles;

    if (filtered.length > 0) {
      onDrop(filtered);
    }
  }, [onDrop, accept]);

  const dragProps = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };

  return { isDragging, dragProps };
}
```

### 3.3 usePasteFile.ts — 粘贴图片检测

```typescript
// packages/ui/src/hooks/usePasteFile.ts
import { useEffect, useCallback } from "react";

interface UsePasteFileOptions {
  enabled: boolean;
  onPaste: (file: File) => void;
}

export function usePasteFile({ enabled, onPaste }: UsePasteFileOptions) {
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault(); // 防止 textarea 插入乱码
          onPaste(file);
          return;
        }
      }
    }
  }, [enabled, onPaste]);

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [enabled, handlePaste]);
}
```

### 3.4 FileUploadPreview.tsx — 上传预览确认

```tsx
// packages/ui/src/files/FileUploadPreview.tsx
import { useState, useMemo } from "react";
import type { UploadTask } from "../hooks/useFileUpload";

interface FileUploadPreviewProps {
  tasks: UploadTask[];
  onConfirm: () => void;
  onCancel: () => void;
  onRemove: (taskId: string) => void;
}

export function FileUploadPreview({
  tasks,
  onConfirm,
  onCancel,
  onRemove,
}: FileUploadPreviewProps) {
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  if (pendingTasks.length === 0) return null;

  return (
    <div className="border-t border-gray-800 bg-magic-surface-alt/50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-300">
          {pendingTasks.length} 个文件待发送
        </span>
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          全部取消
        </button>
      </div>

      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {pendingTasks.map((task) => (
          <FilePreviewItem
            key={task.id}
            task={task}
            onRemove={() => onRemove(task.id)}
          />
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={onConfirm}
          className="rounded-lg bg-magic-primary px-4 py-1.5 text-sm font-medium
                     text-white hover:bg-blue-600 transition-colors"
        >
          发送 {pendingTasks.length > 1 ? `(${pendingTasks.length})` : ""}
        </button>
      </div>
    </div>
  );
}

function FilePreviewItem({
  task,
  onRemove,
}: {
  task: UploadTask;
  onRemove: () => void;
}) {
  const preview = useMemo(() => {
    if (task.file.type.startsWith("image/")) {
      return URL.createObjectURL(task.file);
    }
    return null;
  }, [task.file]);

  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-magic-surface px-2.5 py-1.5">
      {/* 缩略图或图标 */}
      {preview ? (
        <img
          src={preview}
          alt={task.file.name}
          className="h-10 w-10 rounded object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-800 text-lg">
          {getFileEmoji(task.file.type)}
        </div>
      )}

      {/* 文件信息 */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-200">{task.file.name}</p>
        <p className="text-xs text-gray-500">{formatFileSize(task.file.size)}</p>
      </div>

      {/* 删除 */}
      <button
        onClick={onRemove}
        className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-700 hover:text-gray-300 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function getFileEmoji(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  return "📎";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

### 3.5 UploadProgressBar.tsx — 上传进度条

```tsx
// packages/ui/src/files/UploadProgressBar.tsx
import type { UploadTask } from "../hooks/useFileUpload";

interface UploadProgressBarProps {
  tasks: UploadTask[];
  onCancel: (taskId: string) => void;
}

export function UploadProgressBar({ tasks, onCancel }: UploadProgressBarProps) {
  const activeTasks = tasks.filter((t) => t.status === "uploading");
  if (activeTasks.length === 0) return null;

  return (
    <div className="border-t border-gray-800 bg-magic-surface-alt/50 px-4 py-2 space-y-1.5">
      {activeTasks.map((task) => (
        <div key={task.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="truncate text-xs text-gray-300">{task.file.name}</span>
              <span className="shrink-0 text-xs text-gray-500">{task.progress}%</span>
            </div>
            <div className="h-1 rounded-full bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-magic-primary transition-all duration-300"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => onCancel(task.id)}
            className="shrink-0 rounded p-0.5 text-gray-500 hover:text-red-400 transition-colors"
            title="取消上传"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 3.6 DropZoneOverlay.tsx — 拖拽遮罩

```tsx
// packages/ui/src/files/DropZoneOverlay.tsx

export function DropZoneOverlay() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center
                    border-2 border-dashed border-magic-primary bg-magic-primary/10
                    pointer-events-none">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl
                        bg-magic-primary/20">
          <svg className="h-7 w-7 text-magic-primary" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className="text-sm font-medium text-magic-primary">拖放文件到此处上传</p>
        <p className="mt-1 text-xs text-gray-400">支持图片、文档、音视频等文件</p>
      </div>
    </div>
  );
}
```

### 3.7 更新 ChatView.tsx — 拖拽区域

```tsx
// packages/ui/src/chat/ChatView.tsx（更新）
import { useCallback } from "react";
import { useRoomStore, useUIStore } from "@magic/matrix-client";
import { ChatHeader } from "./ChatHeader";
import { ChatTimeline } from "./ChatTimeline";
import { MessageComposer } from "./MessageComposer";
import { FileUploadPreview } from "../files/FileUploadPreview";
import { UploadProgressBar } from "../files/UploadProgressBar";
import { DropZoneOverlay } from "../files/DropZoneOverlay";
import { useFileUpload } from "../hooks/useFileUpload";
import { useDragDrop } from "../hooks/useDragDrop";

export function ChatView() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const setReplyTo = useUIStore((s) => s.setComposerReplyTo);

  if (!activeRoomId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-medium text-gray-300">选择一个房间</h2>
          <p className="mt-2 text-sm text-gray-500">从左侧列表中选择一个房间开始聊天</p>
        </div>
      </div>
    );
  }

  return <ChatViewContent roomId={activeRoomId} onReply={setReplyTo} />;
}

function ChatViewContent({
  roomId,
  onReply,
}: {
  roomId: string;
  onReply: (eventId: string | null) => void;
}) {
  const {
    tasks,
    addFiles,
    startUpload,
    cancelTask,
    removeTask,
    clearCompleted,
    hasActiveTasks,
  } = useFileUpload(roomId);

  // 拖拽
  const { isDragging, dragProps } = useDragDrop({
    onDrop: (files) => addFiles(files),
  });

  // 粘贴图片回调（传给 MessageComposer）
  const handlePasteFile = useCallback((file: File) => {
    addFiles([file]);
  }, [addFiles]);

  const handleCancelAll = useCallback(() => {
    const pending = tasks.filter((t) => t.status === "pending");
    pending.forEach((t) => removeTask(t.id));
  }, [tasks, removeTask]);

  return (
    <div className="relative flex flex-1 flex-col" {...dragProps}>
      <ChatHeader roomId={roomId} />
      <ChatTimeline roomId={roomId} onReply={(eventId) => onReply(eventId)} />

      {/* 上传进度条 */}
      <UploadProgressBar tasks={tasks} onCancel={cancelTask} />

      {/* 文件预览确认 */}
      <FileUploadPreview
        tasks={tasks}
        onConfirm={startUpload}
        onCancel={handleCancelAll}
        onRemove={removeTask}
      />

      {/* 消息编辑器 */}
      <MessageComposer roomId={roomId} onPasteFile={handlePasteFile} />

      {/* 拖拽遮罩 */}
      {isDragging && <DropZoneOverlay />}
    </div>
  );
}
```

### 3.8 更新 MessageComposer.tsx — 粘贴文件支持

```tsx
// packages/ui/src/chat/MessageComposer.tsx（更新）
// 新增 onPasteFile prop：

interface MessageComposerProps {
  roomId: string;
  onPasteFile?: (file: File) => void;  // 新增
}

export function MessageComposer({ roomId, onPasteFile }: MessageComposerProps) {
  // ... 现有代码 ...

  // 粘贴文件检测
  usePasteFile({
    enabled: !!onPasteFile,
    onPaste: (file) => onPasteFile?.(file),
  });

  // ... 其余不变 ...
}
```

### 3.9 更新 ComposerToolbar.tsx — 完善附件逻辑

```tsx
// packages/ui/src/chat/ComposerToolbar.tsx（更新）
// 将 Web 端的文件选择改为调用 useFileUpload.addFiles：

interface ComposerToolbarProps {
  roomId: string;
  onFilesSelected?: (files: File[]) => void;  // 新增
}

export function ComposerToolbar({ roomId, onFilesSelected }: ComposerToolbarProps) {
  const electronAPI = useElectronAPI();

  const handleAttach = useCallback(async () => {
    if (electronAPI) {
      const filePaths = await electronAPI.openFileDialog({
        title: "选择文件",
        multiSelections: true,
        filters: [
          { name: "所有文件", extensions: ["*"] },
          { name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
          { name: "文档", extensions: ["pdf", "doc", "docx", "txt", "md"] },
        ],
      });
      if (filePaths && filePaths.length > 0) {
        // Electron：filePaths 是文件路径，需要读取为 File 对象
        // TODO: 通过 IPC 读取文件内容，或使用 File API
        console.log("选择的文件路径:", filePaths);
      }
    } else {
      // Web：使用 <input type="file">
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.onchange = () => {
        const files = Array.from(input.files ?? []);
        if (files.length > 0 && onFilesSelected) {
          onFilesSelected(files);
        }
      };
      input.click();
    }
  }, [roomId, electronAPI, onFilesSelected]);

  // ... 其余不变 ...
}
```

### 3.10 更新 @magic/ui 导出

追加到 `packages/ui/src/index.ts`：

```typescript
// Files
export { FileUploadPreview } from "./files/FileUploadPreview";
export { UploadProgressBar } from "./files/UploadProgressBar";
export { DropZoneOverlay } from "./files/DropZoneOverlay";

// Hooks
export { useFileUpload } from "./hooks/useFileUpload";
export type { UploadTask } from "./hooks/useFileUpload";
export { useDragDrop } from "./hooks/useDragDrop";
export { usePasteFile } from "./hooks/usePasteFile";
```

---

## 4. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 点击附件按钮可选择文件，显示预览确认 | 手动验证 |
| AC-2 | 预览区域显示文件名、大小、图片缩略图 | 视觉检查 |
| AC-3 | 点击发送后文件开始上传，显示进度条和百分比 | 手动验证（上传较大文件） |
| AC-4 | 上传完成后消息出现在时间线中，进度条 3 秒后消失 | 手动验证 |
| AC-5 | 上传过程中点击 × 可取消上传 | 手动验证 |
| AC-6 | 拖拽文件到聊天区域时显示蓝色虚线遮罩 | 手动验证 |
| AC-7 | 松开鼠标后文件出现在预览确认区域 | 手动验证 |
| AC-8 | Ctrl+V / Cmd+V 粘贴剪贴板图片到编辑器，出现在预览区域 | 截图后粘贴 |
| AC-9 | 可同时选择多个文件，预览区域显示所有文件 | 选择 3+ 个文件 |
| AC-10 | 预览区域可单独移除某个文件 | 手动验证 |
| AC-11 | "全部取消"按钮清除所有待发送文件 | 手动验证 |
| AC-12 | `pnpm typecheck` 全局通过 | `pnpm typecheck` |
| AC-13 | `pnpm test` 所有测试通过 | `pnpm test` |

---

## 5. 实现任务（按执行顺序）

### 任务 1：创建 useFileUpload Hook

**创建文件**：`packages/ui/src/hooks/useFileUpload.ts`

**验证**：`pnpm typecheck`

---

### 任务 2：创建 useDragDrop 和 usePasteFile Hook

**创建文件**：
- `packages/ui/src/hooks/useDragDrop.ts`
- `packages/ui/src/hooks/usePasteFile.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：创建 DropZoneOverlay 和 UploadProgressBar

**创建文件**：
- `packages/ui/src/files/DropZoneOverlay.tsx`
- `packages/ui/src/files/UploadProgressBar.tsx`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 FileUploadPreview

**创建文件**：`packages/ui/src/files/FileUploadPreview.tsx`

**验证**：`pnpm typecheck`

---

### 任务 5：更新 MessageComposer 支持粘贴文件

**修改文件**：`packages/ui/src/chat/MessageComposer.tsx`（增加 `onPasteFile` prop + `usePasteFile`）

**验证**：`pnpm typecheck`

---

### 任务 6：更新 ComposerToolbar 支持多文件 + 回调

**修改文件**：`packages/ui/src/chat/ComposerToolbar.tsx`（增加 `onFilesSelected` prop）

**验证**：`pnpm typecheck`

---

### 任务 7：更新 ChatView 集成拖拽 + 上传 + 预览

**修改文件**：`packages/ui/src/chat/ChatView.tsx`（重构为 ChatViewContent 子组件）

**验证**：`pnpm dev:desktop`（拖拽文件 → 预览 → 上传 → 进度条）

---

### 任务 8：更新 @magic/ui 导出

**修改文件**：`packages/ui/src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 9：编写单元测试

**创建文件**：
- `packages/ui/__tests__/hooks/useFileUpload.test.ts` — addFiles、startUpload、cancelTask、removeTask
- `packages/ui/__tests__/hooks/useDragDrop.test.ts` — isDragging 状态切换
- `packages/ui/__tests__/files/FileUploadPreview.test.tsx` — 文件列表渲染、移除、确认

**验证**：`pnpm test`

---

### 任务 10：全局集成验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 拖拽文件 → 预览 → 上传 → 进度条 → 消息出现
pnpm dev:web       # 同上（无 Electron 文件对话框，使用浏览器 input）
```

完成后提交：
```bash
git add -A
git commit -m "feat: 009 - file attachments with drag-drop, paste, upload progress"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 大文件上传超时 | 上传失败 | homeserver 默认 50MB 限制，大文件需分片——但 Matrix 不支持分片上传，由 homeserver 限制 |
| 拖拽事件在 Electron 中可能被拦截 | 拖拽不工作 | 确保 `webPreferences` 未设置 `disableDialogs` |
| `URL.createObjectURL` 内存泄漏 | 内存增长 | 组件卸载时 `URL.revokeObjectURL()`，FilePreviewItem 中处理 |
| Electron 文件路径 → File 对象转换 | Electron 附件按钮不工作 | 首期 Electron 附件使用 `fs.readFile` + `new File()` 在主进程构造，通过 IPC 传递 |
| 加密房间中的文件上传需要先加密 | 上传文件未加密 | SDK 的 `sendMessage` 在加密房间中自动加密附件内容 |

---

## 7. 后续 Spec 的接入点

- **010-agent-status-dashboard**：Agent 可以发送文件类型的工作成果
- **后续语音消息 spec**：在 ComposerToolbar 增加录音按钮，录制后作为 `m.audio` 上传
- **后续视频播放器 spec**：在 FileMessage 中对 `m.video` 类型内嵌播放器
- **后续文件管理面板 spec**：在右侧面板中按文件类型展示房间内所有文件