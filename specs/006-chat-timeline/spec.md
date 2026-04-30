# Spec 006: 聊天时间线（Chat Timeline）

> 优先级: P0 | 波次: Wave 2 | 预估: 3-4 天 | 前置依赖: 002-matrix-sdk-wrapper, 005-room-list-sidebar

---

## 1. 目标

实现聊天主界面——当用户在侧边栏选中一个房间后，右侧内容区渲染该房间的消息时间线。支持虚拟滚动（高性能渲染数千条消息）、向上滚动自动加载历史、消息气泡（区分自己/他人）、Markdown 渲染、图片/文件附件预览、消息时间分隔线、输入提示指示器、已读回执，以及固定底部的自动跟随行为。

### 用户故事

- 作为用户，我希望点击侧边栏房间后立刻看到最新消息，自动滚到底部
- 作为用户，我希望向上滚动到顶部时自动加载更早的历史消息
- 作为用户，我希望自己发的消息靠右显示蓝色气泡，别人的消息靠左显示灰色气泡
- 作为用户，我希望消息中的 Markdown（粗体、链接、代码块）正确渲染
- 作为用户，我希望图片消息直接显示缩略图，可点击放大
- 作为用户，我希望文件消息显示文件名和大小，可点击下载
- 作为用户，我希望收到新消息时如果已在底部则自动滚到新消息，如果不在底部则显示"↓ 新消息"按钮
- 作为用户，我希望看到日期分隔线（如"今天"、"昨天"、"5月1日"）
- 作为用户，我希望看到对方"正在输入…"的提示

### 非目标（本 spec 不实现）

- 消息编辑/撤回的 UI —— 后续 spec
- 反应（Reaction）emoji 选择器 —— 后续 spec
- 消息右键菜单（回复、复制、删除）—— 后续 spec
- 线程（Thread）视图 —— 后续 spec
- 语音/视频通话 —— 后续 spec

---

## 2. 架构设计

### 2.1 数据流

```
useRoomStore.rooms[activeRoomId].timeline  (SerializedMatrixEvent[])
        ↓
ChatTimeline (react-virtuoso 虚拟滚动)
        ↓
MessageGroup (按发送者 + 时间间隔分组)
        ↓
MessageBubble (单条消息渲染)
        ↓
MessageContent (按 msgtype 分发: 文本/图片/文件/视频/音频)
```

### 2.2 组件结构

```
packages/ui/src/
├── chat/
│   ├── ChatView.tsx              # 聊天主视图容器（时间线 + 房间头部 + 编辑器占位）
│   ├── ChatHeader.tsx            # 房间名称、成员数、加密状态
│   ├── ChatTimeline.tsx          # react-virtuoso 虚拟滚动时间线
│   ├── MessageBubble.tsx         # 单条消息气泡
│   ├── MessageContent.tsx        # 消息内容分发（文本/图片/文件）
│   ├── TextMessage.tsx           # 文本消息（Markdown 渲染）
│   ├── ImageMessage.tsx          # 图片消息（缩略图 + 点击放大）
│   ├── FileMessage.tsx           # 文件/音频/视频消息
│   ├── SystemMessage.tsx         # 系统消息（加入/离开/主题变更）
│   ├── DateSeparator.tsx         # 日期分隔线
│   ├── TypingIndicator.tsx       # 输入提示
│   ├── NewMessageButton.tsx      # "↓ 新消息"浮动按钮
│   └── EmptyRoom.tsx             # 空房间提示
├── hooks/
│   ├── useTimeline.ts            # 时间线数据处理（分组、分隔线插入）
│   └── useScrollToBottom.ts      # 底部跟随逻辑
└── layouts/
    └── MainLayout.tsx            # 更新：接入 ChatView
```

---

## 3. 技术规格

### 3.1 依赖安装

在 `packages/ui/` 中：
```bash
pnpm add react-virtuoso@^4.17.0 react-markdown@^9.0.0 remark-gfm@^4.0.0 react-syntax-highlighter@^15.6.0
pnpm add -D @types/react-syntax-highlighter
```

### 3.2 useTimeline.ts — 时间线数据处理

```typescript
// packages/ui/src/hooks/useTimeline.ts
import { useMemo } from "react";
import { useRoomStore, useTypingStore } from "@magic/matrix-client";
import type { SerializedMatrixEvent } from "@magic/shared-types";

export type TimelineItem =
  | { type: "message"; event: SerializedMatrixEvent; showSender: boolean; isOwn: boolean }
  | { type: "date-separator"; date: string; key: string }
  | { type: "typing"; users: string[] };

interface UseTimelineOptions {
  roomId: string;
  currentUserId: string | null;
}

/**
 * 将原始事件数组转为渲染项列表，插入日期分隔线和发送者折叠逻辑。
 */
export function useTimeline({ roomId, currentUserId }: UseTimelineOptions) {
  const timeline = useRoomStore((s) => s.rooms[roomId]?.timeline ?? []);
  const typingUsers = useTypingStore((s) => s.typing[roomId] ?? []);

  const items: TimelineItem[] = useMemo(() => {
    const result: TimelineItem[] = [];
    let lastDate = "";
    let lastSender = "";
    let lastTs = 0;

    for (const event of timeline) {
      // 跳过非消息事件（state 事件等）的渲染由 SystemMessage 处理
      const isMessage = event.type === "m.room.message";
      const isStateEvent = isStateType(event.type);
      if (!isMessage && !isStateEvent) continue;

      // 日期分隔线
      const dateStr = formatDateSeparator(event.timestamp);
      if (dateStr !== lastDate) {
        result.push({
          type: "date-separator",
          date: dateStr,
          key: `date-${event.timestamp}`,
        });
        lastDate = dateStr;
        lastSender = ""; // 跨日期重置发送者
      }

      // 发送者折叠：同一发送者在 5 分钟内的连续消息不重复显示头像和名称
      const sameGroup =
        event.sender === lastSender &&
        event.timestamp - lastTs < 5 * 60 * 1000;

      result.push({
        type: "message",
        event,
        showSender: !sameGroup,
        isOwn: event.sender === currentUserId,
      });

      lastSender = event.sender;
      lastTs = event.timestamp;
    }

    // 输入提示
    if (typingUsers.length > 0) {
      const filtered = typingUsers.filter((u) => u !== currentUserId);
      if (filtered.length > 0) {
        result.push({ type: "typing", users: filtered });
      }
    }

    return result;
  }, [timeline, typingUsers, currentUserId]);

  return { items, messageCount: timeline.length };
}

function isStateType(type: string): boolean {
  return [
    "m.room.member",
    "m.room.topic",
    "m.room.name",
    "m.room.encryption",
  ].includes(type);
}

function formatDateSeparator(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return "今天";
  if (isSameDay(date, yesterday)) return "昨天";

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (year === today.getFullYear()) {
    return `${month}月${day}日`;
  }
  return `${year}年${month}月${day}日`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
```

### 3.3 ChatTimeline.tsx — 虚拟滚动时间线

```tsx
// packages/ui/src/chat/ChatTimeline.tsx
import { useCallback, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { paginateBackwards, useRoomStore, useAuthStore } from "@magic/matrix-client";
import { useTimeline, type TimelineItem } from "../hooks/useTimeline";
import { MessageBubble } from "./MessageBubble";
import { DateSeparator } from "./DateSeparator";
import { TypingIndicator } from "./TypingIndicator";
import { NewMessageButton } from "./NewMessageButton";
import { EmptyRoom } from "./EmptyRoom";

interface ChatTimelineProps {
  roomId: string;
}

const START_INDEX = 100_000;

export function ChatTimeline({ roomId }: ChatTimelineProps) {
  const currentUserId = useAuthStore((s) => s.userId);
  const { items, messageCount } = useTimeline({ roomId, currentUserId });
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 向上滚到顶部 → 加载历史
  const handleStartReached = useCallback(async () => {
    if (isLoadingHistory) return;
    setIsLoadingHistory(true);
    try {
      await paginateBackwards(roomId, 50);
    } catch (err) {
      console.error("加载历史失败:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [roomId, isLoadingHistory]);

  // 滚到底部
  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: items.length - 1,
      behavior: "smooth",
    });
  }, [items.length]);

  // 空房间
  if (messageCount === 0 && items.length === 0) {
    return <EmptyRoom />;
  }

  return (
    <div className="relative flex-1">
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: "100%" }}
        data={items}
        firstItemIndex={START_INDEX - items.length}
        initialTopMostItemIndex={items.length - 1}
        startReached={handleStartReached}
        followOutput={(isBottom) => (isBottom ? "smooth" : false)}
        atBottomStateChange={setIsAtBottom}
        atBottomThreshold={60}
        skipAnimationFrameInResizeObserver={true}
        increaseViewportBy={{ top: 400, bottom: 200 }}
        itemContent={(_index, item) => (
          <TimelineItemRenderer item={item} />
        )}
        components={{
          Header: () =>
            isLoadingHistory ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
              </div>
            ) : null,
        }}
      />

      {/* "↓ 新消息"浮动按钮 */}
      {!isAtBottom && (
        <NewMessageButton onClick={scrollToBottom} />
      )}
    </div>
  );
}

/** 根据 item 类型分发渲染 */
function TimelineItemRenderer({ item }: { item: TimelineItem }) {
  switch (item.type) {
    case "message":
      return (
        <MessageBubble
          event={item.event}
          showSender={item.showSender}
          isOwn={item.isOwn}
        />
      );
    case "date-separator":
      return <DateSeparator date={item.date} />;
    case "typing":
      return <TypingIndicator users={item.users} />;
    default:
      return null;
  }
}
```

### 3.4 MessageBubble.tsx — 消息气泡

```tsx
// packages/ui/src/chat/MessageBubble.tsx
import { memo } from "react";
import { RoomAvatar } from "../rooms/RoomAvatar";
import { MessageContent } from "./MessageContent";
import type { SerializedMatrixEvent } from "@magic/shared-types";

interface MessageBubbleProps {
  event: SerializedMatrixEvent;
  showSender: boolean;
  isOwn: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  event,
  showSender,
  isOwn,
}: MessageBubbleProps) {
  const isSystemEvent = !event.type.startsWith("m.room.message");
  if (isSystemEvent) {
    return <SystemEventLine event={event} />;
  }

  const time = formatTime(event.timestamp);
  const senderName = extractDisplayName(event.sender);

  return (
    <div
      className={`flex gap-2.5 px-4 ${showSender ? "mt-3" : "mt-0.5"} ${
        isOwn ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* 头像（仅在 showSender 时显示，否则占位） */}
      <div className="w-8 shrink-0">
        {showSender && !isOwn && (
          <RoomAvatar
            name={senderName}
            avatarMxc={null}
            isDirect={true}
            size={32}
          />
        )}
      </div>

      {/* 消息体 */}
      <div className={`max-w-[70%] min-w-0 ${isOwn ? "items-end" : "items-start"}`}>
        {/* 发送者名称 */}
        {showSender && !isOwn && (
          <p className="mb-0.5 text-xs font-medium text-gray-400">
            {senderName}
          </p>
        )}

        {/* 气泡 */}
        <div
          className={`inline-block rounded-2xl px-3 py-2 text-sm leading-relaxed ${
            isOwn
              ? "rounded-br-md bg-magic-primary text-white"
              : "rounded-bl-md bg-magic-surface-alt text-gray-100"
          }`}
        >
          <MessageContent event={event} isOwn={isOwn} />
        </div>

        {/* 时间 */}
        <p className={`mt-0.5 text-[10px] text-gray-500 ${
          isOwn ? "text-right" : "text-left"
        }`}>
          {time}
        </p>
      </div>
    </div>
  );
});

/** 系统事件（成员变更、主题变更等）显示为居中的灰色小字 */
function SystemEventLine({ event }: { event: SerializedMatrixEvent }) {
  const text = getSystemEventText(event);
  if (!text) return null;

  return (
    <div className="flex justify-center px-4 py-2">
      <span className="rounded-full bg-gray-800/50 px-3 py-1 text-xs text-gray-500">
        {text}
      </span>
    </div>
  );
}

function getSystemEventText(event: SerializedMatrixEvent): string | null {
  const sender = extractDisplayName(event.sender);

  switch (event.type) {
    case "m.room.member": {
      const membership = event.content.membership as string;
      if (membership === "join") return `${sender} 加入了房间`;
      if (membership === "leave") return `${sender} 离开了房间`;
      if (membership === "invite") return `${sender} 被邀请加入`;
      return null;
    }
    case "m.room.topic":
      return `${sender} 更新了房间话题`;
    case "m.room.name":
      return `${sender} 更新了房间名称为「${event.content.name}」`;
    case "m.room.encryption":
      return "已启用端到端加密";
    default:
      return null;
  }
}

function extractDisplayName(userId: string): string {
  // @username:server.com → username
  const match = userId.match(/^@([^:]+)/);
  return match ? match[1] : userId;
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
```

### 3.5 MessageContent.tsx — 消息内容分发

```tsx
// packages/ui/src/chat/MessageContent.tsx
import type { SerializedMatrixEvent } from "@magic/shared-types";
import { TextMessage } from "./TextMessage";
import { ImageMessage } from "./ImageMessage";
import { FileMessage } from "./FileMessage";

interface MessageContentProps {
  event: SerializedMatrixEvent;
  isOwn: boolean;
}

export function MessageContent({ event, isOwn }: MessageContentProps) {
  const content = event.content;
  const msgtype = content.msgtype as string;

  switch (msgtype) {
    case "m.text":
    case "m.notice":
      return (
        <TextMessage
          body={content.body as string}
          formattedBody={content.formatted_body as string | undefined}
          format={content.format as string | undefined}
          isOwn={isOwn}
        />
      );
    case "m.image":
      return (
        <ImageMessage
          body={content.body as string}
          url={content.url as string}
          info={content.info as Record<string, unknown> | undefined}
        />
      );
    case "m.file":
    case "m.audio":
    case "m.video":
      return (
        <FileMessage
          body={content.body as string}
          url={content.url as string}
          msgtype={msgtype}
          info={content.info as Record<string, unknown> | undefined}
        />
      );
    case "m.emote":
      return (
        <span className="italic text-gray-300">
          * {extractDisplayName(event.sender)} {content.body as string}
        </span>
      );
    default:
      return <span className="text-gray-500">[不支持的消息类型: {msgtype}]</span>;
  }
}

function extractDisplayName(userId: string): string {
  const match = userId.match(/^@([^:]+)/);
  return match ? match[1] : userId;
}
```

### 3.6 TextMessage.tsx — 文本消息（Markdown）

```tsx
// packages/ui/src/chat/TextMessage.tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface TextMessageProps {
  body: string;
  formattedBody?: string;
  format?: string;
  isOwn: boolean;
}

export function TextMessage({ body, formattedBody, format, isOwn }: TextMessageProps) {
  // 如果服务端提供了 HTML 格式内容，优先使用 Markdown 渲染纯文本 body
  // （避免 XSS：不直接 dangerouslySetInnerHTML）
  return (
    <div className="prose prose-sm prose-invert max-w-none break-words
                    prose-p:my-0.5 prose-pre:my-1 prose-code:text-xs
                    prose-a:text-blue-300 prose-a:underline">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 代码块
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const inline = !match && !className;

            if (inline) {
              return (
                <code
                  className={`rounded px-1 py-0.5 text-xs ${
                    isOwn ? "bg-blue-700/50" : "bg-gray-700"
                  }`}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <SyntaxHighlighter
                style={oneDark}
                language={match?.[1] ?? "text"}
                PreTag="div"
                customStyle={{
                  margin: "4px 0",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            );
          },
          // 链接在新窗口打开
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          // 段落不加额外 margin
          p({ children }) {
            return <p className="my-0">{children}</p>;
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
```

### 3.7 ImageMessage.tsx — 图片消息

```tsx
// packages/ui/src/chat/ImageMessage.tsx
import { useState, useMemo } from "react";
import { mxcToHttp } from "@magic/matrix-client";

interface ImageMessageProps {
  body: string;
  url: string;
  info?: Record<string, unknown>;
}

export function ImageMessage({ body, url, info }: ImageMessageProps) {
  const [showFullSize, setShowFullSize] = useState(false);

  // 缩略图（最大 400x300）
  const thumbUrl = useMemo(() => mxcToHttp(url, 400, 300, "scale"), [url]);
  // 原图
  const fullUrl = useMemo(() => mxcToHttp(url), [url]);

  // 预留空间防止布局抖动
  const width = (info?.w as number) ?? 300;
  const height = (info?.h as number) ?? 200;
  const aspectRatio = width / height;
  const displayWidth = Math.min(width, 400);
  const displayHeight = displayWidth / aspectRatio;

  return (
    <>
      <button
        onClick={() => setShowFullSize(true)}
        className="block overflow-hidden rounded-lg"
      >
        <img
          src={thumbUrl ?? ""}
          alt={body}
          loading="lazy"
          className="max-w-full object-cover"
          style={{
            width: displayWidth,
            height: displayHeight,
            maxHeight: 300,
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = "";
            (e.target as HTMLImageElement).alt = "图片加载失败";
          }}
        />
      </button>

      {/* 全屏预览 */}
      {showFullSize && fullUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80
                     cursor-zoom-out"
          onClick={() => setShowFullSize(false)}
        >
          <img
            src={fullUrl}
            alt={body}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}
```

### 3.8 FileMessage.tsx — 文件消息

```tsx
// packages/ui/src/chat/FileMessage.tsx
import { useMemo } from "react";
import { mxcToHttp } from "@magic/matrix-client";

interface FileMessageProps {
  body: string;
  url: string;
  msgtype: string;
  info?: Record<string, unknown>;
}

export function FileMessage({ body, url, msgtype, info }: FileMessageProps) {
  const httpUrl = useMemo(() => mxcToHttp(url), [url]);
  const size = info?.size as number | undefined;
  const sizeStr = size ? formatFileSize(size) : "";
  const icon = getFileIcon(msgtype);

  return (
    <a
      href={httpUrl ?? "#"}
      download={body}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-lg border border-gray-700 bg-gray-800/50
                 px-3 py-2 transition-colors hover:bg-gray-700/50"
    >
      <span className="text-lg">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-200">{body}</p>
        {sizeStr && (
          <p className="text-xs text-gray-500">{sizeStr}</p>
        )}
      </div>
      <DownloadIcon />
    </a>
  );
}

function getFileIcon(msgtype: string): string {
  switch (msgtype) {
    case "m.audio": return "🎵";
    case "m.video": return "🎬";
    default: return "📎";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
```

### 3.9 DateSeparator.tsx — 日期分隔线

```tsx
// packages/ui/src/chat/DateSeparator.tsx
import { memo } from "react";

interface DateSeparatorProps {
  date: string;
}

export const DateSeparator = memo(function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-px flex-1 bg-gray-800" />
      <span className="text-xs font-medium text-gray-500">{date}</span>
      <div className="h-px flex-1 bg-gray-800" />
    </div>
  );
});
```

### 3.10 TypingIndicator.tsx — 输入提示

```tsx
// packages/ui/src/chat/TypingIndicator.tsx
import { memo } from "react";

interface TypingIndicatorProps {
  users: string[];
}

export const TypingIndicator = memo(function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const names = users.map((u) => {
    const match = u.match(/^@([^:]+)/);
    return match ? match[1] : u;
  });

  let text: string;
  if (names.length === 1) {
    text = `${names[0]} 正在输入`;
  } else if (names.length === 2) {
    text = `${names[0]} 和 ${names[1]} 正在输入`;
  } else {
    text = `${names[0]} 等 ${names.length} 人正在输入`;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <BouncingDots />
      <span className="text-xs text-gray-500">{text}</span>
    </div>
  );
});

function BouncingDots() {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-gray-500"
          style={{
            animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
```

### 3.11 NewMessageButton.tsx — 新消息浮动按钮

```tsx
// packages/ui/src/chat/NewMessageButton.tsx

interface NewMessageButtonProps {
  onClick: () => void;
}

export function NewMessageButton({ onClick }: NewMessageButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full
                 bg-magic-primary px-4 py-1.5 text-xs font-medium text-white
                 shadow-lg transition-all hover:bg-blue-600"
    >
      ↓ 新消息
    </button>
  );
}
```

### 3.12 EmptyRoom.tsx — 空房间提示

```tsx
// packages/ui/src/chat/EmptyRoom.tsx

export function EmptyRoom() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-gray-800 flex items-center justify-center">
          <span className="text-2xl">💬</span>
        </div>
        <p className="text-sm text-gray-400">暂无消息</p>
        <p className="mt-1 text-xs text-gray-500">发送第一条消息开始对话</p>
      </div>
    </div>
  );
}
```

### 3.13 ChatHeader.tsx — 房间头部

```tsx
// packages/ui/src/chat/ChatHeader.tsx
import { useRoomStore } from "@magic/matrix-client";
import { RoomAvatar } from "../rooms/RoomAvatar";

interface ChatHeaderProps {
  roomId: string;
}

export function ChatHeader({ roomId }: ChatHeaderProps) {
  const room = useRoomStore((s) => s.rooms[roomId]);
  if (!room) return null;

  return (
    <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3">
      <RoomAvatar
        name={room.name}
        avatarMxc={room.avatarMxc}
        isDirect={room.isDirect}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {room.isEncrypted && (
            <svg className="h-3 w-3 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          )}
          <h2 className="truncate text-sm font-semibold text-white">
            {room.name || "未命名房间"}
          </h2>
        </div>
        <p className="truncate text-xs text-gray-500">
          {room.memberCount} 位成员
          {room.topic ? ` · ${room.topic}` : ""}
        </p>
      </div>
    </div>
  );
}
```

### 3.14 ChatView.tsx — 聊天主视图容器

```tsx
// packages/ui/src/chat/ChatView.tsx
import { useRoomStore } from "@magic/matrix-client";
import { ChatHeader } from "./ChatHeader";
import { ChatTimeline } from "./ChatTimeline";

export function ChatView() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);

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
      <ChatTimeline roomId={activeRoomId} />
      {/* 消息编辑器占位 — 007-message-composer 填充 */}
      <div className="border-t border-gray-800 px-4 py-3">
        <div className="rounded-lg border border-gray-700 bg-magic-surface-alt px-3 py-2 text-sm text-gray-500">
          消息编辑器（Spec 007）
        </div>
      </div>
    </div>
  );
}
```

### 3.15 更新 MainLayout.tsx — 接入 ChatView

```tsx
// packages/ui/src/layouts/MainLayout.tsx（更新 main 区域）
import { useAuthStore } from "@magic/matrix-client";
import { useAuth } from "../hooks/useAuth";
import { RoomList } from "../rooms/RoomList";
import { ChatView } from "../chat/ChatView";

export function MainLayout() {
  const { userId, homeserver } = useAuthStore();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-magic-surface text-white">
      {/* 侧边栏（保持 005 的内容） */}
      <aside className="flex w-64 flex-col border-r border-gray-800 bg-magic-surface-alt">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-bold tracking-wide">MAGIC</span>
        </div>
        <div className="flex-1 min-h-0">
          <RoomList />
        </div>
        <div className="border-t border-gray-800 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{userId}</p>
              <p className="truncate text-xs text-gray-500">{homeserver}</p>
            </div>
            <button
              onClick={logout}
              className="ml-2 shrink-0 rounded px-2 py-1 text-xs text-gray-400
                         hover:bg-gray-700 hover:text-white transition-colors"
            >
              登出
            </button>
          </div>
        </div>
      </aside>

      {/* 聊天区域 */}
      <ChatView />
    </div>
  );
}
```

### 3.16 追加 CSS 动画

在 `index.css`（桌面端和 Web 端）追加：

```css
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}
```

### 3.17 更新 @magic/ui 导出

追加到 `packages/ui/src/index.ts`：

```typescript
// Chat
export { ChatView } from "./chat/ChatView";
export { ChatHeader } from "./chat/ChatHeader";
export { ChatTimeline } from "./chat/ChatTimeline";
export { MessageBubble } from "./chat/MessageBubble";
export { MessageContent } from "./chat/MessageContent";
export { TextMessage } from "./chat/TextMessage";
export { ImageMessage } from "./chat/ImageMessage";
export { FileMessage } from "./chat/FileMessage";
export { DateSeparator } from "./chat/DateSeparator";
export { TypingIndicator } from "./chat/TypingIndicator";
export { NewMessageButton } from "./chat/NewMessageButton";
export { EmptyRoom } from "./chat/EmptyRoom";

// Hooks
export { useTimeline } from "./hooks/useTimeline";
```

---

## 4. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 点击侧边栏房间后右侧显示该房间的消息时间线 | 手动验证 |
| AC-2 | 自动滚到底部显示最新消息 | 手动验证 |
| AC-3 | 向上滚到顶部时触发历史加载，显示 spinner | 手动验证 |
| AC-4 | 自己的消息靠右蓝色气泡，他人的消息靠左灰色气泡 | 视觉检查 |
| AC-5 | 同一发送者 5 分钟内的连续消息折叠头像和名称 | 视觉检查 |
| AC-6 | Markdown 正确渲染（粗体、链接、代码块带语法高亮） | 发送含 Markdown 的消息 |
| AC-7 | 图片消息显示缩略图，点击弹出全屏预览 | 手动验证 |
| AC-8 | 文件消息显示文件名/大小/下载图标，可点击下载 | 手动验证 |
| AC-9 | 日期变更时显示日期分隔线（今天/昨天/具体日期） | 视觉检查 |
| AC-10 | 对方输入时底部显示"xxx 正在输入"+ 跳动点动画 | 从另一客户端输入 |
| AC-11 | 不在底部时收到新消息显示"↓ 新消息"按钮，点击滚到底部 | 手动验证 |
| AC-12 | 系统消息（加入/离开/加密）居中灰色小字显示 | 视觉检查 |
| AC-13 | 切换房间时时间线正确切换，无残留旧消息 | 快速切换多个房间 |
| AC-14 | `pnpm typecheck` 全局通过 | `pnpm typecheck` |
| AC-15 | `pnpm test` 所有测试通过 | `pnpm test` |

---

## 5. 实现任务（按执行顺序）

### 任务 1：安装依赖

```bash
cd packages/ui && pnpm add react-virtuoso@^4.17.0 react-markdown@^9.0.0 remark-gfm@^4.0.0 react-syntax-highlighter@^15.6.0
pnpm add -D @types/react-syntax-highlighter
```

**验证**：`pnpm install`

---

### 任务 2：创建 useTimeline Hook

**创建文件**：`packages/ui/src/hooks/useTimeline.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：创建基础组件（DateSeparator、TypingIndicator、NewMessageButton、EmptyRoom）

**创建文件**：
- `packages/ui/src/chat/DateSeparator.tsx`
- `packages/ui/src/chat/TypingIndicator.tsx`
- `packages/ui/src/chat/NewMessageButton.tsx`
- `packages/ui/src/chat/EmptyRoom.tsx`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 TextMessage、ImageMessage、FileMessage

**创建文件**：
- `packages/ui/src/chat/TextMessage.tsx`
- `packages/ui/src/chat/ImageMessage.tsx`
- `packages/ui/src/chat/FileMessage.tsx`

**验证**：`pnpm typecheck`

---

### 任务 5：创建 MessageContent 和 MessageBubble

**创建文件**：
- `packages/ui/src/chat/MessageContent.tsx`
- `packages/ui/src/chat/MessageBubble.tsx`

**验证**：`pnpm typecheck`

---

### 任务 6：创建 ChatHeader

**创建文件**：`packages/ui/src/chat/ChatHeader.tsx`

**验证**：`pnpm typecheck`

---

### 任务 7：创建 ChatTimeline（react-virtuoso 核心）

**创建文件**：`packages/ui/src/chat/ChatTimeline.tsx`

**验证**：`pnpm typecheck`

---

### 任务 8：创建 ChatView 并更新 MainLayout

**创建文件**：`packages/ui/src/chat/ChatView.tsx`

**修改文件**：`packages/ui/src/layouts/MainLayout.tsx`

**追加 CSS**：bounce 动画关键帧

**验证**：`pnpm dev:desktop`（点击房间显示消息时间线）

---

### 任务 9：更新 @magic/ui 导出

**修改文件**：`packages/ui/src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 10：编写单元测试

**创建文件**：
- `packages/ui/__tests__/chat/MessageBubble.test.tsx` — 自己/他人气泡、发送者折叠
- `packages/ui/__tests__/chat/TextMessage.test.tsx` — Markdown 渲染
- `packages/ui/__tests__/hooks/useTimeline.test.ts` — 日期分隔线插入、发送者分组

**验证**：`pnpm test`

---

### 任务 11：全局集成验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 登录 → 选房间 → 看到消息时间线
pnpm dev:web       # 同上
```

完成后提交：
```bash
git add -A
git commit -m "feat: 006 - chat timeline with virtual scroll, markdown, media preview"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| react-virtuoso 图片加载导致滚动抖动 | 用户体验差 | `skipAnimationFrameInResizeObserver={true}` + 预留图片尺寸 |
| react-markdown + react-syntax-highlighter 体积较大 | 首屏加载慢 | 后续可 lazy import `SyntaxHighlighter` |
| 大量消息时 useTimeline 的 useMemo 计算耗时 | 卡顿 | 分组逻辑为 O(n)，万条消息仍在 ~10ms 内 |
| MXC 图片 URL 需要认证 header | 图片加载失败 | `mxcToHttp()` 已设置 `useAuthentication: true` |

---

## 7. 后续 Spec 的接入点

- **007-message-composer**：替换 ChatView 底部的占位编辑器
- **008-e2ee-setup**：在 ChatHeader 增加加密验证状态指示
- **009-file-attachments**：扩展 ImageMessage/FileMessage 增加上传进度和拖拽上传
- **后续反应 spec**：在 MessageBubble 底部增加 ReactionBar
- **后续线程 spec**：在 MessageBubble 增加"回复线程"按钮