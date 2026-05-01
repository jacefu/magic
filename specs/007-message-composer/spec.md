# Spec 007: 消息编辑器（Message Composer）

> 优先级: P0 | 波次: Wave 2 | 预估: 2-3 天 | 前置依赖: 002-matrix-sdk-wrapper, 006-chat-timeline

---

## 1. 目标

替换 006 中 ChatView 底部的占位编辑器，实现完整的消息输入组件——支持多行文本输入、Markdown 实时预览、回复引用、文件附件入口、输入提示发送、Enter 发送 / Shift+Enter 换行、以及 Emoji 快捷输入。完成后，用户可以在聊天界面中发送文本消息、回复特定消息、附带文件。

### 用户故事

- 作为用户，我希望在输入框中键入文字后按 Enter 即可发送消息
- 作为用户，我希望按 Shift+Enter 可以换行，支持多行消息
- 作为用户，我希望输入框高度随内容自动扩展（最多 6 行），超过后出现滚动条
- 作为用户，我希望输入 Markdown（`**粗体**`、`` `代码` ``、`[链接](url)`）后发送的消息自动渲染
- 作为用户，我希望点击消息的"回复"按钮后，编辑器顶部显示引用预览，发送时自动关联原消息
- 作为用户，我希望有一个附件按钮可以选择文件发送到当前房间
- 作为用户，我希望输入时对方能看到"正在输入…"提示
- 作为用户，我希望发送消息后输入框自动清空并聚焦
- 作为用户，我希望切换房间时输入框内容保留（草稿功能）

### 非目标（本 spec 不实现）

- Emoji 选择器面板 —— 后续 spec
- @提及自动补全 —— 后续 spec
- 斜杠命令（/commands）—— 后续 spec
- 富文本 WYSIWYG 编辑器（Tiptap）—— 后续升级

---

## 2. 架构设计

### 2.1 组件结构

```
packages/ui/src/
├── chat/
│   ├── ChatView.tsx              # 更新：接入 MessageComposer
│   ├── MessageComposer.tsx       # 编辑器容器（回复条 + 输入区 + 工具栏）
│   ├── ComposerInput.tsx         # 多行 textarea 核心
│   ├── ComposerToolbar.tsx       # 底部工具栏（附件、Emoji、Markdown 提示）
│   ├── ReplyPreview.tsx          # 回复引用预览条
│   └── MessageBubble.tsx         # 更新：增加回复按钮
├── hooks/
│   ├── useComposer.ts            # 编辑器状态管理（草稿、发送、回复）
│   └── useTypingNotifier.ts      # 输入提示节流发送
└── stores/
    # uiStore 已有 composerReplyTo 字段
```

### 2.2 草稿机制

每个房间的输入草稿存储在一个 `Map<roomId, string>` 中（内存级别），切换房间时保留，关闭应用时丢弃。不使用 localStorage——草稿不需要跨会话持久化。

### 2.3 输入提示节流

用户输入时向服务器发送 typing 通知，使用节流策略：首次输入立即发送，此后每 10 秒最多发送一次，停止输入 5 秒后发送"停止输入"。

---

## 3. 技术规格

### 3.1 useComposer.ts — 编辑器状态管理

```typescript
// packages/ui/src/hooks/useComposer.ts
import { useCallback, useRef, useState } from "react";
import {
  sendTextMessage,
  sendReply,
  useRoomStore,
  useUIStore,
} from "@magic/matrix-client";
import { useTypingNotifier } from "./useTypingNotifier";

interface UseComposerOptions {
  roomId: string;
}

// 跨房间草稿存储（模块级，非持久化）
const drafts = new Map<string, string>();

export function useComposer({ roomId }: UseComposerOptions) {
  const [value, setValue] = useState(() => drafts.get(roomId) ?? "");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const replyToEventId = useUIStore((s) => s.composerReplyTo);
  const setReplyTo = useUIStore((s) => s.setComposerReplyTo);
  const activeRoom = useRoomStore((s) => s.rooms[roomId]);

  // 输入提示
  const { notifyTyping, stopTyping } = useTypingNotifier(roomId);

  // 输入变化
  const handleChange = useCallback((text: string) => {
    setValue(text);
    drafts.set(roomId, text);
    if (text.trim()) {
      notifyTyping();
    } else {
      stopTyping();
    }
  }, [roomId, notifyTyping, stopTyping]);

  // 发送消息
  const handleSend = useCallback(async () => {
    const text = value.trim();
    if (!text || isSending) return;

    setIsSending(true);
    stopTyping();

    try {
      if (replyToEventId) {
        await sendReply(roomId, text, replyToEventId);
        setReplyTo(null);
      } else {
        await sendTextMessage(roomId, text);
      }
      // 清空
      setValue("");
      drafts.delete(roomId);
      // 聚焦
      inputRef.current?.focus();
    } catch (err) {
      console.error("发送消息失败:", err);
      // TODO: 显示错误 toast
    } finally {
      setIsSending(false);
    }
  }, [value, isSending, roomId, replyToEventId, setReplyTo, stopTyping]);

  // 取消回复
  const cancelReply = useCallback(() => {
    setReplyTo(null);
  }, [setReplyTo]);

  // 开始回复某条消息
  const startReply = useCallback((eventId: string) => {
    setReplyTo(eventId);
    inputRef.current?.focus();
  }, [setReplyTo]);

  // 获取回复消息的预览文本
  const replyEvent = replyToEventId
    ? activeRoom?.timeline.find((e) => e.eventId === replyToEventId)
    : null;

  // 切换房间时恢复草稿
  const switchRoom = useCallback((newRoomId: string) => {
    setValue(drafts.get(newRoomId) ?? "");
  }, []);

  return {
    value,
    setValue: handleChange,
    isSending,
    inputRef,
    replyEvent,
    replyToEventId,
    handleSend,
    cancelReply,
    startReply,
    switchRoom,
  };
}
```

### 3.2 useTypingNotifier.ts — 输入提示节流

```typescript
// packages/ui/src/hooks/useTypingNotifier.ts
import { useCallback, useRef, useEffect } from "react";
import { sendTyping } from "@magic/matrix-client";

const THROTTLE_MS = 10_000;   // 每 10 秒最多发一次 typing
const TIMEOUT_MS = 5_000;     // 停止输入 5 秒后发送 stop

export function useTypingNotifier(roomId: string) {
  const lastSentRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // 清理
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (isTypingRef.current) {
        sendTyping(roomId, false).catch(() => {});
      }
    };
  }, [roomId]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();

    // 节流：距上次发送不足 THROTTLE_MS 则跳过
    if (now - lastSentRef.current >= THROTTLE_MS) {
      sendTyping(roomId, true).catch(() => {});
      lastSentRef.current = now;
      isTypingRef.current = true;
    }

    // 重置停止计时器
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      sendTyping(roomId, false).catch(() => {});
      isTypingRef.current = false;
    }, TIMEOUT_MS);
  }, [roomId]);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (isTypingRef.current) {
      sendTyping(roomId, false).catch(() => {});
      isTypingRef.current = false;
    }
  }, [roomId]);

  return { notifyTyping, stopTyping };
}
```

### 3.3 MessageComposer.tsx — 编辑器容器

```tsx
// packages/ui/src/chat/MessageComposer.tsx
import { useEffect } from "react";
import { useComposer } from "../hooks/useComposer";
import { ComposerInput } from "./ComposerInput";
import { ComposerToolbar } from "./ComposerToolbar";
import { ReplyPreview } from "./ReplyPreview";

interface MessageComposerProps {
  roomId: string;
}

export function MessageComposer({ roomId }: MessageComposerProps) {
  const {
    value,
    setValue,
    isSending,
    inputRef,
    replyEvent,
    handleSend,
    cancelReply,
    switchRoom,
  } = useComposer({ roomId });

  // 切换房间时恢复草稿
  useEffect(() => {
    switchRoom(roomId);
  }, [roomId, switchRoom]);

  return (
    <div className="border-t border-gray-800 bg-magic-surface">
      {/* 回复预览条 */}
      {replyEvent && (
        <ReplyPreview event={replyEvent} onCancel={cancelReply} />
      )}

      {/* 输入区域 */}
      <div className="px-4 py-2">
        <div className="flex items-end gap-2 rounded-xl border border-gray-700
                        bg-magic-surface-alt px-3 py-2 focus-within:border-magic-primary
                        focus-within:ring-1 focus-within:ring-magic-primary transition-colors">
          <ComposerInput
            ref={inputRef}
            value={value}
            onChange={setValue}
            onSend={handleSend}
            disabled={isSending}
            placeholder="输入消息…"
          />

          {/* 发送按钮 */}
          <button
            onClick={handleSend}
            disabled={isSending || !value.trim()}
            className="shrink-0 rounded-lg p-1.5 text-magic-primary transition-colors
                       hover:bg-magic-primary/10 disabled:text-gray-600 disabled:hover:bg-transparent"
            title="发送 (Enter)"
          >
            <SendIcon />
          </button>
        </div>

        {/* 工具栏 */}
        <ComposerToolbar roomId={roomId} />
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}
```

### 3.4 ComposerInput.tsx — 多行输入核心

```tsx
// packages/ui/src/chat/ComposerInput.tsx
import { forwardRef, useCallback, useEffect, useRef } from "react";

interface ComposerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_ROWS = 6;
const LINE_HEIGHT = 20; // px
const MIN_HEIGHT = LINE_HEIGHT + 8; // 1行 + padding
const MAX_HEIGHT = LINE_HEIGHT * MAX_ROWS + 8;

export const ComposerInput = forwardRef<HTMLTextAreaElement, ComposerInputProps>(
  function ComposerInput({ value, onChange, onSend, disabled, placeholder }, ref) {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) ?? internalRef;

    // 自动调整高度
    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // 重置高度以获得正确的 scrollHeight
      textarea.style.height = `${MIN_HEIGHT}px`;
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, MAX_HEIGHT)}px`;
    }, [textareaRef]);

    // 值变化时调整高度
    useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    // 键盘事件
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter 发送（不带修饰键）
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onSend();
          return;
        }
        // Ctrl+Enter 或 Cmd+Enter 也发送（备用）
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onSend();
          return;
        }
        // Shift+Enter → 正常换行（浏览器默认行为）
      },
      [onSend],
    );

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className="flex-1 resize-none bg-transparent text-sm text-white
                   placeholder-gray-500 outline-none disabled:opacity-50"
        style={{
          minHeight: MIN_HEIGHT,
          maxHeight: MAX_HEIGHT,
          lineHeight: `${LINE_HEIGHT}px`,
        }}
      />
    );
  },
);
```

### 3.5 ComposerToolbar.tsx — 底部工具栏

```tsx
// packages/ui/src/chat/ComposerToolbar.tsx
import { useCallback } from "react";
import { uploadAndSendFile } from "@magic/matrix-client";
import { isElectron, useElectronAPI } from "../hooks/useElectronAPI";

interface ComposerToolbarProps {
  roomId: string;
}

export function ComposerToolbar({ roomId }: ComposerToolbarProps) {
  const electronAPI = useElectronAPI();

  const handleAttach = useCallback(async () => {
    if (electronAPI) {
      // Electron：使用原生文件对话框
      const files = await electronAPI.openFileDialog({
        title: "选择文件",
        filters: [
          { name: "所有文件", extensions: ["*"] },
          { name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
          { name: "文档", extensions: ["pdf", "doc", "docx", "txt", "md"] },
        ],
      });
      if (files && files.length > 0) {
        // TODO: 009-file-attachments 实现完整的文件上传流程
        console.log("选择的文件:", files);
      }
    } else {
      // Web：使用 <input type="file">
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = false;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          try {
            await uploadAndSendFile(roomId, file);
          } catch (err) {
            console.error("文件上传失败:", err);
          }
        }
      };
      input.click();
    }
  }, [roomId, electronAPI]);

  return (
    <div className="mt-1 flex items-center gap-1">
      {/* 附件按钮 */}
      <button
        onClick={handleAttach}
        className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300
                   transition-colors"
        title="发送文件"
      >
        <AttachIcon />
      </button>

      {/* Markdown 提示 */}
      <span className="ml-auto text-[10px] text-gray-600">
        支持 Markdown · Enter 发送 · Shift+Enter 换行
      </span>
    </div>
  );
}

function AttachIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}
```

### 3.6 ReplyPreview.tsx — 回复引用预览

```tsx
// packages/ui/src/chat/ReplyPreview.tsx
import type { SerializedMatrixEvent } from "@magic/shared-types";

interface ReplyPreviewProps {
  event: SerializedMatrixEvent;
  onCancel: () => void;
}

export function ReplyPreview({ event, onCancel }: ReplyPreviewProps) {
  const senderName = extractDisplayName(event.sender);
  const body = (event.content.body as string) ?? "";
  const preview = body.length > 80 ? body.slice(0, 80) + "…" : body;

  return (
    <div className="flex items-center gap-2 border-b border-gray-800 bg-magic-surface-alt/50 px-4 py-2">
      {/* 蓝色竖线 */}
      <div className="w-0.5 self-stretch rounded-full bg-magic-primary" />

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-magic-primary">
          回复 {senderName}
        </p>
        <p className="truncate text-xs text-gray-400">{preview}</p>
      </div>

      <button
        onClick={onCancel}
        className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-700 hover:text-gray-300
                   transition-colors"
        title="取消回复"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function extractDisplayName(userId: string): string {
  const match = userId.match(/^@([^:]+)/);
  return match ? match[1] : userId;
}

function CloseIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
```

### 3.7 更新 MessageBubble.tsx — 增加回复按钮

在 006 的 `MessageBubble.tsx` 中，为每条消息增加悬浮回复按钮：

```tsx
// 在 MessageBubble 组件的气泡区域增加 hover 工具栏
// 修改 packages/ui/src/chat/MessageBubble.tsx

// 在 Props 中新增:
interface MessageBubbleProps {
  event: SerializedMatrixEvent;
  showSender: boolean;
  isOwn: boolean;
  onReply?: (eventId: string) => void;  // 新增
}

// 在气泡容器外层包裹 group，添加 hover 工具栏:
export const MessageBubble = memo(function MessageBubble({
  event,
  showSender,
  isOwn,
  onReply,
}: MessageBubbleProps) {
  // ... 现有逻辑 ...

  return (
    <div className={`group flex gap-2.5 px-4 ${showSender ? "mt-3" : "mt-0.5"} ${
      isOwn ? "flex-row-reverse" : "flex-row"
    }`}>
      {/* 头像 */}
      {/* ... 现有代码 ... */}

      {/* 消息体 */}
      <div className={`relative max-w-[70%] min-w-0`}>
        {/* 悬浮工具栏 */}
        {onReply && (
          <div className={`absolute -top-3 ${isOwn ? "left-0" : "right-0"}
                          hidden group-hover:flex items-center gap-0.5
                          rounded-lg border border-gray-700 bg-magic-surface-alt
                          px-1 py-0.5 shadow-lg`}>
            <button
              onClick={() => onReply(event.eventId)}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-700 hover:text-white
                         transition-colors"
              title="回复"
            >
              <ReplyIcon />
            </button>
          </div>
        )}

        {/* 发送者名称 + 气泡 + 时间（现有代码） */}
        {/* ... */}
      </div>
    </div>
  );
});

function ReplyIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  );
}
```

### 3.8 更新 ChatTimeline.tsx — 传递 onReply

在 006 的 `ChatTimeline.tsx` 中，将 `onReply` 回调传入 `MessageBubble`：

```tsx
// 在 ChatTimeline 组件中：
import { useComposer } from "../hooks/useComposer";

// 在 ChatTimeline 中新增 prop
interface ChatTimelineProps {
  roomId: string;
  onReply?: (eventId: string) => void;  // 新增
}

// TimelineItemRenderer 中传递 onReply
function TimelineItemRenderer({ item, onReply }: { item: TimelineItem; onReply?: (eventId: string) => void }) {
  switch (item.type) {
    case "message":
      return (
        <MessageBubble
          event={item.event}
          showSender={item.showSender}
          isOwn={item.isOwn}
          onReply={onReply}
        />
      );
    // ... 其他类型不变
  }
}
```

### 3.9 更新 ChatView.tsx — 集成 MessageComposer

```tsx
// packages/ui/src/chat/ChatView.tsx（更新）
import { useCallback } from "react";
import { useRoomStore, useUIStore } from "@magic/matrix-client";
import { ChatHeader } from "./ChatHeader";
import { ChatTimeline } from "./ChatTimeline";
import { MessageComposer } from "./MessageComposer";

export function ChatView() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const setReplyTo = useUIStore((s) => s.setComposerReplyTo);

  const handleReply = useCallback((eventId: string) => {
    setReplyTo(eventId);
  }, [setReplyTo]);

  if (!activeRoomId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-medium text-gray-300">选择一个房间</h2>
          <p className="mt-2 text-sm text-gray-500">
            从左侧列表中选择一个房间开始聊天
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <ChatHeader roomId={activeRoomId} />
      <ChatTimeline roomId={activeRoomId} onReply={handleReply} />
      <MessageComposer roomId={activeRoomId} />
    </div>
  );
}
```

### 3.10 更新 @magic/ui 导出

追加到 `packages/ui/src/index.ts`：

```typescript
// Composer
export { MessageComposer } from "./chat/MessageComposer";
export { ComposerInput } from "./chat/ComposerInput";
export { ComposerToolbar } from "./chat/ComposerToolbar";
export { ReplyPreview } from "./chat/ReplyPreview";

// Hooks
export { useComposer } from "./hooks/useComposer";
export { useTypingNotifier } from "./hooks/useTypingNotifier";
```

---

## 4. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 输入框中输入文字后按 Enter 发送消息，消息出现在时间线中 | 手动验证 |
| AC-2 | Shift+Enter 换行，不发送 | 手动验证 |
| AC-3 | 输入框高度随内容自动扩展，最多 6 行后出现滚动条 | 手动验证 |
| AC-4 | 发送 Markdown 文本后在时间线中正确渲染（粗体、代码、链接） | 发送 `**粗体** 和 \`代码\`` |
| AC-5 | 发送后输入框自动清空并聚焦 | 手动验证 |
| AC-6 | 悬浮消息气泡时出现回复按钮 | 手动验证 |
| AC-7 | 点击回复按钮后编辑器顶部显示引用预览条（蓝色竖线 + 原消息预览） | 手动验证 |
| AC-8 | 回复状态下发送消息后，引用预览自动消失 | 手动验证 |
| AC-9 | 点击引用预览条的 × 按钮取消回复 | 手动验证 |
| AC-10 | 输入时对方客户端显示"正在输入…" | 从另一个客户端观察 |
| AC-11 | 停止输入 5 秒后对方的输入提示消失 | 从另一个客户端观察 |
| AC-12 | 切换房间后输入框恢复该房间的草稿内容 | 在 A 房间输入 → 切 B → 切回 A |
| AC-13 | 附件按钮可打开文件选择器（Electron 用原生对话框，Web 用 input） | 手动验证 |
| AC-14 | 空输入时 Enter 不发送，发送按钮灰色禁用 | 手动验证 |
| AC-15 | `pnpm typecheck` 全局通过 | `pnpm typecheck` |
| AC-16 | `pnpm test` 所有测试通过 | `pnpm test` |

---

## 5. 实现任务（按执行顺序）

### 任务 1：创建 useTypingNotifier Hook

**创建文件**：
- `packages/ui/src/hooks/useTypingNotifier.ts`

**验证**：`pnpm typecheck`

---

### 任务 2：创建 useComposer Hook

**创建文件**：
- `packages/ui/src/hooks/useComposer.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：创建 ComposerInput 组件

**创建文件**：
- `packages/ui/src/chat/ComposerInput.tsx`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 ReplyPreview 组件

**创建文件**：
- `packages/ui/src/chat/ReplyPreview.tsx`

**验证**：`pnpm typecheck`

---

### 任务 5：创建 ComposerToolbar 组件

**创建文件**：
- `packages/ui/src/chat/ComposerToolbar.tsx`

**验证**：`pnpm typecheck`

---

### 任务 6：创建 MessageComposer 容器

**创建文件**：
- `packages/ui/src/chat/MessageComposer.tsx`

**验证**：`pnpm typecheck`

---

### 任务 7：更新 MessageBubble 增加回复按钮

**修改文件**：
- `packages/ui/src/chat/MessageBubble.tsx`（增加 `onReply` prop + hover 工具栏）

**验证**：`pnpm typecheck`

---

### 任务 8：更新 ChatTimeline 传递 onReply

**修改文件**：
- `packages/ui/src/chat/ChatTimeline.tsx`（增加 `onReply` prop 传递到 MessageBubble）

**验证**：`pnpm typecheck`

---

### 任务 9：更新 ChatView 集成 MessageComposer

**修改文件**：
- `packages/ui/src/chat/ChatView.tsx`（替换占位编辑器为 MessageComposer）

**验证**：`pnpm dev:desktop`（可输入并发送消息）

---

### 任务 10：更新 @magic/ui 导出

**修改文件**：
- `packages/ui/src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 11：编写单元测试

**创建文件**：
- `packages/ui/__tests__/chat/ComposerInput.test.tsx` — Enter 发送、Shift+Enter 换行、禁用状态
- `packages/ui/__tests__/hooks/useTypingNotifier.test.ts` — 节流逻辑、停止提示
- `packages/ui/__tests__/hooks/useComposer.test.ts` — 草稿保存/恢复、回复状态管理

**验证**：`pnpm test`

---

### 任务 12：全局集成验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 登录 → 选房间 → 发消息 → 回复 → 切房间草稿
pnpm dev:web       # 同上
```

完成后提交：
```bash
git add -A
git commit -m "feat: 007 - message composer with reply, draft, typing indicator"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| textarea 自动高度在某些浏览器中不稳定 | 高度闪烁 | 重置 → 读 scrollHeight → 设置，在 `useEffect` 中同步执行 |
| 输入提示过于频繁消耗服务器资源 | 限流 | 10 秒节流 + 5 秒自动停止 |
| Electron 文件对话框阻塞主线程 | UI 卡顿 | `dialog.showOpenDialog` 是异步的，不会阻塞 |
| 草稿存在内存中，刷新页面丢失 | 用户丢失草稿 | 可接受——长文本建议在外部编辑器准备好后粘贴 |
| `sendReply` 的 `m.relates_to` 格式需与服务端匹配 | 回复关联失败 | 002 中已按 Matrix spec 实现 |

---

## 7. 后续 Spec 的接入点

- **008-e2ee-setup**：在 MessageComposer 中如果房间未加密显示警告提示
- **009-file-attachments**：扩展 ComposerToolbar 的附件按钮，增加上传进度条、拖拽上传、粘贴图片
- **后续 Emoji spec**：在 ComposerToolbar 增加 Emoji 选择器按钮
- **后续 @提及 spec**：在 ComposerInput 中检测 `@` 触发自动补全
- **后续 Tiptap 升级 spec**：替换 textarea 为 Tiptap 富文本编辑器