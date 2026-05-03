# Spec 019: 体验优化三项修复（UX Fixes）

> 优先级: P0 | 波次: Wave 5 | 预估: 1 天 | 前置依赖: 006-chat-timeline, 007-message-composer, 014-agent-tags-mention-rendering
> 文件路径: `specs/019-ux-fixes/spec.md`

---

## 1. 目标

修复三个影响日常使用的体验问题。

| # | 问题 | 严重度 | 影响 |
|---|------|--------|------|
| FIX-1 | Agent 在线状态判断不准，经常误判 | 🟡 | 绿点显示在线但实际离线，误导用户 |
| FIX-2 | 中文输入法输入英文时，回车确认拼音直接把消息发出去了 | 🔴 | 中文用户几乎无法正常输入英文 |
| FIX-3 | 发送消息后聊天窗口不滚动到最底部 | 🔴 | 每次发完消息都要手动往下拉，体验极差 |

---

## 2. FIX-1：移除 Agent 在线状态判断

### 问题分析

当前通过 Matrix Presence 判断 Agent 是否在线，但实际环境中：
- Tuwunel 的 Presence 推送不稳定，经常延迟或丢失
- Agent 容器在运行但 Presence 仍显示 offline
- 误判导致用户以为 Agent 不可用，实际是可用的

### 修复方案

**移除所有在线/离线状态指示，统一为无状态显示。**

具体变更：

1. **房间列表 DM 项**：移除状态圆点（绿/黄/灰），改为统一的用户图标或无前缀
2. **成员面板**：移除"在线 — N" / "离线 — N"分组，改为**按角色分组**（Agent / 真人）或**单一列表**按字母排序
3. **成员面板头像**：移除右下角状态指示点
4. **保留 `presenceUtils.ts` 和 `presenceStore.ts` 文件**但不在 UI 中使用——后续 Presence 稳定后可以重新启用

### 修改文件

| 文件 | 变更 |
|------|------|
| `packages/ui/src/rooms/RoomListItem.tsx` | 移除 DM 状态圆点（`getDmPresenceColor` 调用），私聊项前缀改为 `@` 符号或头像缩略 |
| `packages/ui/src/panels/MemberPanel.tsx` | 移除按在线/离线分组，改为按角色分组（Agent / 真人）或单一列表；移除头像状态点 |
| `packages/ui/src/hooks/useRoomMembers.ts` | 移除 `getUserPresence` 调用（保留 `getAgentInfo` 用于 Agent 识别） |

### 修改代码

#### RoomListItem.tsx — 移除状态圆点

```tsx
// 之前：
{room.isDirect ? (
  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
    <span className="h-2 w-2 rounded-full"
          style={{ backgroundColor: getDmPresenceColor(room.roomId) }} />
  </span>
) : (
  <span className="..." >#</span>
)}

// 之后：
{room.isDirect ? (
  <span className="w-4 shrink-0 text-center text-[13px] leading-none"
        style={{ color: 'var(--text-tertiary)' }}>@</span>
) : (
  <span className="w-4 shrink-0 text-center text-base leading-none"
        style={{ color: 'var(--text-tertiary)' }}>#</span>
)}
```

#### MemberPanel.tsx — 移除在线/离线分组

```tsx
// 之前：
const online = members.filter((m) => {
  const status = getUserPresence(m.userId);
  return status === "online" || status === "idle";
});
const offline = members.filter((m) => {
  const status = getUserPresence(m.userId);
  return status === "offline";
});

return (
  <>
    {online.length > 0 && <MemberSection label={`在线 — ${online.length}`} members={online} />}
    {offline.length > 0 && <MemberSection label={`离线 — ${offline.length}`} members={offline} />}
  </>
);

// 之后：
const agents = members.filter((m) => getAgentInfo(m.userId).isAgent);
const humans = members.filter((m) => !getAgentInfo(m.userId).isAgent);

return (
  <>
    {agents.length > 0 && <MemberSection label={`Agent — ${agents.length}`} members={agents} />}
    {humans.length > 0 && <MemberSection label={`成员 — ${humans.length}`} members={humans} />}
  </>
);
```

#### MemberItem — 移除状态点

```tsx
// 之前：
<div className="absolute -bottom-px -right-px ...">
  <div className="..." style={{ backgroundColor: statusColor }} />
</div>

// 之后：
// 删除整个状态点 div
```

---

## 3. FIX-2：修复中文输入法回车误发送

### 问题分析

中文输入法（搜狗、微软拼音、macOS 原生等）在输入英文时的流程：

```
用户输入 "hello" → 输入法显示候选 "hello" → 用户按回车确认 → "hello" 上屏
```

回车键在这个场景下有两个含义：
1. **输入法层面**：确认候选词上屏（`compositionend` 事件）
2. **应用层面**：发送消息

当前代码只监听了 `keydown` 事件的 `Enter` 键，没有区分这两种情况，导致确认候选词的回车直接触发了发送。

### 修复方案

使用 `KeyboardEvent.isComposing` 属性——当输入法正在组合输入时，`isComposing` 为 `true`。此时按下的 Enter 键是用来确认候选的，不应该触发发送。

**同时**需要处理一个浏览器兼容性问题：某些浏览器在 `compositionend` 后会立即触发一个 `keydown` 事件，且 `isComposing` 已经为 `false`。需要用一个短暂的标志位来防止这个"幽灵回车"。

### 修改代码

```tsx
// packages/ui/src/chat/MessageComposer.tsx

import { useState, useRef, useCallback, type KeyboardEvent, type FormEvent } from "react";

export function MessageComposer({ roomId, onSend }: MessageComposerProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ⭐ 关键：追踪输入法组合状态
  const isComposingRef = useRef(false);
  // 防止 compositionend 后的幽灵回车
  const justFinishedComposingRef = useRef(false);

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false;
    // 设置标志位，在下一个事件循环重置
    justFinishedComposingRef.current = true;
    setTimeout(() => {
      justFinishedComposingRef.current = false;
    }, 0);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return;

    // ⭐ 输入法正在组合 → 不发送（让输入法处理这个回车）
    if (e.nativeEvent.isComposing || isComposingRef.current) return;

    // ⭐ 刚刚结束组合的幽灵回车 → 不发送
    if (justFinishedComposingRef.current) return;

    // Shift+Enter → 换行
    if (e.shiftKey) return;

    // 正常回车 → 发送
    e.preventDefault();
    handleSend();
  }, [message, roomId]);

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed) return;

    onSend(trimmed);
    setMessage("");

    // 重置输入框高度
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [message, onSend]);

  return (
    <div className="composer">
      <div className="comp-box">
        {/* 附件按钮 */}
        <button className="comp-att">+</button>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={`发消息到 #${roomName}`}
          rows={1}
          className="comp-input"
        />
      </div>
    </div>
  );
}
```

### 关键技术点

| 机制 | 作用 |
|------|------|
| `e.nativeEvent.isComposing` | 标准属性，Chrome/Firefox/Safari 均支持。组合中为 `true` |
| `onCompositionStart` / `onCompositionEnd` | React 事件，追踪组合状态的起止 |
| `isComposingRef` | 冗余保护——某些浏览器 `isComposing` 不可靠时的后备 |
| `justFinishedComposingRef` + `setTimeout(0)` | 防止 `compositionend` 之后立即触发的幽灵 `keydown` |

---

## 4. FIX-3：发送消息后自动滚动到底部

### 问题分析

当前 `ChatTimeline` 使用 `react-virtuoso` 做虚拟滚动，但发送消息后没有触发 `scrollToBottom`。消息被添加到 timeline 数组后，滚动位置保持不变，用户需要手动往下拉才能看到自己刚发的消息。

### 修复方案

三个触发滚动到底部的场景：

| 场景 | 触发时机 | 行为 |
|------|---------|------|
| 发送消息 | `handleSend()` 执行后 | 立即滚动到底部 |
| 收到新消息且已在底部 | 新消息追加到 timeline | 如果用户已经在底部附近（距底部 < 200px），自动滚动到底部 |
| 收到新消息但在上方浏览 | 新消息追加到 timeline | 不打断用户浏览，显示"↓ N 条新消息"提示条 |

### 修改代码

#### ChatTimeline.tsx — 暴露 scrollToBottom 并追踪底部状态

```tsx
// packages/ui/src/chat/ChatTimeline.tsx

import { useRef, useCallback, useState, useEffect } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

interface ChatTimelineProps {
  roomId: string;
  /** 由 MessageComposer 调用，发送后滚动到底部 */
  scrollToBottomRef?: React.MutableRefObject<(() => void) | null>;
}

export function ChatTimeline({ roomId, scrollToBottomRef }: ChatTimelineProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const timeline = useRoomStore((s) => {
    const rooms = s.sessionRooms?.[s.activeSessionId ?? ""] ?? s.rooms ?? {};
    return rooms[roomId]?.timeline ?? [];
  });

  // ⭐ 暴露 scrollToBottom 方法给父组件
  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: "LAST",
      behavior: "smooth",
    });
    setNewMessageCount(0);
  }, []);

  // 将 scrollToBottom 挂载到 ref 上
  useEffect(() => {
    if (scrollToBottomRef) {
      scrollToBottomRef.current = scrollToBottom;
    }
  }, [scrollToBottom, scrollToBottomRef]);

  // ⭐ 新消息到达时的处理
  const prevLengthRef = useRef(timeline.length);
  useEffect(() => {
    if (timeline.length > prevLengthRef.current) {
      const newCount = timeline.length - prevLengthRef.current;

      if (isAtBottom) {
        // 用户在底部 → 自动滚动到最新消息
        // 使用 requestAnimationFrame 确保 DOM 已更新
        requestAnimationFrame(() => {
          virtuosoRef.current?.scrollToIndex({
            index: "LAST",
            behavior: "smooth",
          });
        });
      } else {
        // 用户在上方浏览 → 显示新消息提示
        setNewMessageCount((prev) => prev + newCount);
      }
    }
    prevLengthRef.current = timeline.length;
  }, [timeline.length, isAtBottom]);

  return (
    <div className="relative flex-1">
      <Virtuoso
        ref={virtuosoRef}
        data={timeline}
        initialTopMostItemIndex={timeline.length - 1}
        followOutput="smooth"
        atBottomStateChange={(atBottom) => {
          setIsAtBottom(atBottom);
          if (atBottom) setNewMessageCount(0);
        }}
        atBottomThreshold={200}
        itemContent={(index, event) => (
          <MessageBubble
            key={event.eventId}
            event={event}
            showSender={shouldShowSender(timeline, index)}
          />
        )}
      />

      {/* ⭐ 新消息提示条（用户不在底部时显示） */}
      {newMessageCount > 0 && !isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10
                     rounded-full px-4 py-1.5 text-xs font-medium shadow-lg
                     transition-all animate-[fade-in-up_0.2s_ease-out]"
          style={{
            background: 'var(--gradient-button)',
            color: '#fff',
          }}
        >
          ↓ {newMessageCount} 条新消息
        </button>
      )}
    </div>
  );
}
```

#### ChatArea.tsx — 连接 Composer 和 Timeline

```tsx
// packages/ui/src/chat/ChatArea.tsx（或包含 Composer 和 Timeline 的父组件）

import { useRef } from "react";

export function ChatArea({ roomId }: { roomId: string }) {
  // ⭐ 连接 Composer 和 Timeline 的 scrollToBottom
  const scrollToBottomRef = useRef<(() => void) | null>(null);

  const handleSend = useCallback(async (content: string) => {
    await sendTextMessage(roomId, content);

    // ⭐ 发送后立即滚动到底部
    // 使用短延迟确保消息已添加到 timeline
    setTimeout(() => {
      scrollToBottomRef.current?.();
    }, 50);
  }, [roomId]);

  return (
    <div className="flex flex-1 flex-col">
      <ChatHeader roomId={roomId} />
      <ChatTimeline roomId={roomId} scrollToBottomRef={scrollToBottomRef} />
      <MessageComposer roomId={roomId} onSend={handleSend} />
    </div>
  );
}
```

### Virtuoso 配置要点

| 属性 | 值 | 作用 |
|------|-----|------|
| `initialTopMostItemIndex` | `timeline.length - 1` | 首次加载时显示最后一条消息 |
| `followOutput` | `"smooth"` | 当用户在底部时，新数据自动平滑滚动 |
| `atBottomStateChange` | callback | 追踪用户是否在底部 |
| `atBottomThreshold` | `200` | 距底部 200px 以内视为"在底部" |

---

## 5. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 房间列表 DM 项不再显示在线状态圆点 | 视觉检查 |
| AC-2 | 成员面板按 Agent/成员 分组，不再按在线/离线分组 | 视觉检查 |
| AC-3 | 成员头像右下角没有状态指示点 | 视觉检查 |
| AC-4 | 切换到中文输入法，输入英文 "hello"，按回车确认上屏，消息不会被发出 | 手动测试 |
| AC-5 | 确认上屏后，再按回车，消息正常发出 | 手动测试 |
| AC-6 | 切换到中文输入法，输入中文"你好"，选词确认后不会发出，再按回车才发出 | 手动测试 |
| AC-7 | Shift+Enter 仍然换行，不发送 | 手动测试 |
| AC-8 | 发送消息后聊天窗口自动滚动到最新消息 | 发送消息后观察 |
| AC-9 | 连续发送多条消息，每次都能看到最新的 | 连发 5 条测试 |
| AC-10 | 用户向上浏览历史消息时收到新消息，不会自动跳转到底部 | 滚动到上方，等待新消息 |
| AC-11 | 用户向上浏览时收到新消息，底部出现"↓ N 条新消息"提示条 | 视觉检查 |
| AC-12 | 点击"↓ N 条新消息"提示条后滚动到底部 | 手动测试 |
| AC-13 | `pnpm typecheck && pnpm build` 通过 | 命令验证 |

---

## 6. 实现任务（按执行顺序）

### 任务 1：移除在线状态指示

**修改文件**：
- `packages/ui/src/rooms/RoomListItem.tsx`（移除状态圆点，DM 前缀改为 `@`）
- `packages/ui/src/panels/MemberPanel.tsx`（移除在线/离线分组，改为 Agent/成员 分组；移除头像状态点）
- `packages/ui/src/hooks/useRoomMembers.ts`（移除 `getUserPresence` 调用）

**不删除的文件**（保留以备后续恢复）：
- `packages/ui/src/lib/presenceUtils.ts`
- `packages/matrix-client/src/stores/presenceStore.ts`
- `packages/matrix-client/src/presence.ts`

**验证**：`pnpm typecheck`

---

### 任务 2：修复输入法回车误发送

**修改文件**：`packages/ui/src/chat/MessageComposer.tsx`

**变更**：
- 追加 `isComposingRef` + `justFinishedComposingRef`
- 追加 `onCompositionStart` / `onCompositionEnd` 事件处理
- `handleKeyDown` 中增加 `isComposing` 检查（三重保护）
- textarea 追加 `onCompositionStart={handleCompositionStart}` 和 `onCompositionEnd={handleCompositionEnd}`

**验证**：`pnpm typecheck`，然后切换到中文输入法测试

---

### 任务 3：发送后自动滚动到底部

**修改文件**：
- `packages/ui/src/chat/ChatTimeline.tsx`（追加 `scrollToBottomRef` prop + `isAtBottom` 追踪 + 新消息提示条）
- `packages/ui/src/chat/ChatArea.tsx` 或包含 Timeline 和 Composer 的父组件（连接 `scrollToBottomRef` + 发送后调用）

**验证**：`pnpm typecheck`，然后发送消息测试滚动

---

### 任务 4：全局验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop
# 测试三项修复：
# 1. 房间列表和成员面板无状态圆点
# 2. 中文输入法输入英文回车不误发送
# 3. 发送消息后自动滚动到底部
```

完成后提交：
```bash
git add -A
git commit -m "fix: 019 - remove presence indicators, fix IME enter, auto-scroll on send"
```

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 移除在线状态后用户不知道 Agent 是否可用 | 信息缺失 | 后续可在 Agent 卡片或消息中显示"最后活跃时间"作为替代 |
| `justFinishedComposingRef` 的 `setTimeout(0)` 在极端情况下可能不够 | 幽灵回车仍触发 | 可改为 `setTimeout(10)` 增加容差 |
| `scrollToIndex("LAST")` 在 timeline 频繁更新时可能闪烁 | 视觉抖动 | `requestAnimationFrame` + `behavior: "smooth"` 缓解 |
| 移除 `presenceUtils` 的 import 后其他组件编译报错 | 编译失败 | 任务 1 中全局搜索所有 `getUserPresence` / `getPresenceColor` 引用 |