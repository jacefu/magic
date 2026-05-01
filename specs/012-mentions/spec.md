# Spec 012: @Mention 提及功能（Mentions）

> 优先级: P1 | 波次: Wave 4 | 预估: 3-4 天 | 前置依赖: 002-matrix-sdk-wrapper, 006-chat-timeline, 007-message-composer
> 文件路径: `specs/012-mentions/spec.md`

---

## 1. 目标

实现聊天中的 @mention 功能——用户在编辑器中输入 `@` 后弹出房间成员自动补全列表（区分真人和 Worker Agent），选中后在消息中插入带样式的提及标记，发送时携带 Matrix `m.mentions` 字段，时间线中高亮显示提及内容，被提及者收到高优先级通知。完成后，用户可以在 Matrix 房间中像使用企业 IM 一样 @mention 任何真人或 Agent 进行定向沟通。

### 用户故事

- 作为用户，我希望在输入框中输入 `@` 后看到当前房间所有成员的下拉列表（真人和 Agent）
- 作为用户，我希望继续输入文字后列表实时过滤匹配
- 作为用户，我希望列表中能区分真人（显示用户头像）和 Agent（显示 Agent 状态点 + 运行时标签）
- 作为用户，我希望用方向键选择、Enter 或点击确认插入 mention
- 作为用户，我希望插入后的 @名称 在输入框中以蓝色高亮样式显示
- 作为用户，我希望发送的消息中 @mention 符合 Matrix 规范，被提及者收到高亮通知
- 作为用户，我希望在时间线中看到 @mention 以蓝色可点击文字显示
- 作为用户，我希望看到提及我的消息有特殊高亮（红色未读 badge，与 005 的 `highlightCount` 联动）
- 作为用户，我希望可以 `@全体` 提及房间内所有成员

### 非目标（本 spec 不实现）

- 频道/房间级别的 @mention（如 @here / @channel 类 Slack 语义）—— 后续 spec
- 提及后自动跳转到被提及者的 Profile 页 —— 后续 spec
- 提及触发的 Agent 自动响应逻辑 —— 由 Agent 运行时处理，客户端仅负责发送

---

## 2. 架构设计

### 2.1 Matrix Mention 规范

Matrix 使用 `m.mentions` 字段（MSC3952，已进入稳定规范）标记消息中的提及：

```json
{
  "msgtype": "m.text",
  "body": "@alice 请帮忙 review 一下代码",
  "format": "org.matrix.custom.html",
  "formatted_body": "<a href='https://matrix.to/#/@alice:magic.com'>alice</a> 请帮忙 review 一下代码",
  "m.mentions": {
    "user_ids": ["@alice:magic.com"]
  }
}
```

提及全体成员使用 `"room": true`：

```json
{
  "m.mentions": {
    "room": true
  }
}
```

### 2.2 数据流

```
用户输入 "@" 
    ↓
MentionAutocomplete 弹出（从房间成员列表 + Agent 状态数据构建候选项）
    ↓ 用户选择
ComposerInput 插入 mention 占位符（内部格式: `[@displayName](userId)`）
    ↓ 用户点击发送
parseMentions() 解析占位符 → 生成 body + formatted_body + m.mentions
    ↓
sendTextMessage() / sendReply() 发送到 Matrix
    ↓
bridge.ts → useRoomStore → 时间线渲染
    ↓
MentionPill 高亮渲染提及文字
```

### 2.3 组件结构

```
packages/ui/src/
├── mentions/
│   ├── MentionAutocomplete.tsx     # @mention 自动补全下拉面板
│   ├── MentionItem.tsx             # 下拉列表中的单个候选项
│   ├── MentionPill.tsx             # 时间线中的提及高亮标签
│   └── MentionAllItem.tsx          # "@全体成员"特殊项
├── hooks/
│   ├── useMentionAutocomplete.ts   # 自动补全状态管理（触发、过滤、导航）
│   └── useRoomMembers.ts           # 房间成员列表（真人 + Agent 合并）
├── chat/
│   ├── ComposerInput.tsx           # 更新：@检测 + 自动补全集成
│   ├── MessageComposer.tsx         # 更新：发送前解析 mention
│   └── TextMessage.tsx             # 更新：渲染 mention pill
└── lib/
    └── mentionParser.ts            # mention 格式化与解析工具
```

---

## 3. 技术规格

### 3.1 useRoomMembers.ts — 房间成员列表

```typescript
// packages/ui/src/hooks/useRoomMembers.ts
import { useMemo } from "react";
import { getClient, useAgentStore, useAuthStore } from "@magic/matrix-client";
import type { AgentData } from "@magic/matrix-client";

export interface RoomMember {
  userId: string;
  displayName: string;
  avatarMxc: string | null;
  isAgent: boolean;
  agentStatus?: AgentData["status"];
  agentRuntime?: string;           // openclaw / qwenpaw / hermes
  powerLevel: number;
}

/**
 * 获取当前房间的所有成员（真人 + Agent），合并 Agent 状态信息。
 */
export function useRoomMembers(roomId: string | null): RoomMember[] {
  const currentUserId = useAuthStore((s) => s.userId);
  const agents = useAgentStore((s) => s.agents);

  return useMemo(() => {
    if (!roomId) return [];

    const client = getClient();
    const room = client.getRoom(roomId);
    if (!room) return [];

    const members = room.getJoinedMembers();
    const agentUserIds = new Set(
      Object.values(agents)
        .filter((a) => a.roomId === roomId)
        .map((a) => a.userId)
    );

    return members
      .filter((m) => m.userId !== currentUserId) // 排除自己
      .map((member): RoomMember => {
        const isAgent = agentUserIds.has(member.userId);
        const agentData = isAgent
          ? Object.values(agents).find(
              (a) => a.userId === member.userId && a.roomId === roomId,
            )
          : undefined;

        return {
          userId: member.userId,
          displayName: member.name || extractName(member.userId),
          avatarMxc: member.getMxcAvatarUrl() ?? null,
          isAgent,
          agentStatus: agentData?.status,
          agentRuntime: agentData?.model,
          powerLevel: room.getMemberPowerLevel(member.userId),
        };
      })
      .sort((a, b) => {
        // Agent 优先 → 按名称排序
        if (a.isAgent !== b.isAgent) return a.isAgent ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [roomId, agents, currentUserId]);
}

function extractName(userId: string): string {
  const match = userId.match(/^@([^:]+)/);
  return match ? match[1] : userId;
}
```

### 3.2 useMentionAutocomplete.ts — 自动补全状态

```typescript
// packages/ui/src/hooks/useMentionAutocomplete.ts
import { useState, useCallback, useMemo, useRef } from "react";
import { useRoomMembers, type RoomMember } from "./useRoomMembers";

interface UseMentionAutocompleteOptions {
  roomId: string;
  inputValue: string;
  cursorPosition: number;
}

interface MentionAutocompleteState {
  isOpen: boolean;
  query: string;           // "@" 后的过滤文字
  triggerIndex: number;     // "@" 在 inputValue 中的位置
  selectedIndex: number;    // 当前键盘高亮的候选项索引
  candidates: MentionCandidate[];
}

export interface MentionCandidate {
  type: "user" | "room";   // room = @全体
  member?: RoomMember;
  label: string;
}

export function useMentionAutocomplete({
  roomId,
  inputValue,
  cursorPosition,
}: UseMentionAutocompleteOptions) {
  const members = useRoomMembers(roomId);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // 检测光标前是否有未闭合的 "@"
  const mentionContext = useMemo(() => {
    const textBeforeCursor = inputValue.slice(0, cursorPosition);

    // 从光标往前找最近的 "@"
    // 规则：@ 前面必须是空白、行首或无内容（避免匹配邮箱中的 @）
    const regex = /(?:^|[\s\n])@([^\s@]*)$/;
    const match = textBeforeCursor.match(regex);

    if (!match) {
      return { isOpen: false, query: "", triggerIndex: -1 };
    }

    const query = match[1]; // @ 后面的文字
    const triggerIndex = textBeforeCursor.lastIndexOf("@" + query);

    return { isOpen: true, query, triggerIndex };
  }, [inputValue, cursorPosition]);

  // 过滤候选项
  const candidates = useMemo((): MentionCandidate[] => {
    if (!mentionContext.isOpen) return [];

    const q = mentionContext.query.toLowerCase();
    const result: MentionCandidate[] = [];

    // "@全体" 选项
    if ("全体".includes(q) || "all".includes(q) || "room".includes(q) || q === "") {
      result.push({ type: "room", label: "全体成员" });
    }

    // 成员过滤
    const filtered = members.filter((m) => {
      const name = m.displayName.toLowerCase();
      const userId = m.userId.toLowerCase();
      return name.includes(q) || userId.includes(q);
    });

    for (const member of filtered.slice(0, 10)) {
      result.push({ type: "user", member, label: member.displayName });
    }

    return result;
  }, [mentionContext.isOpen, mentionContext.query, members]);

  // 重置选中索引（候选项变化时）
  useMemo(() => {
    setSelectedIndex(0);
  }, [candidates.length]);

  // 键盘导航
  const navigateUp = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : candidates.length - 1));
  }, [candidates.length]);

  const navigateDown = useCallback(() => {
    setSelectedIndex((prev) => (prev < candidates.length - 1 ? prev + 1 : 0));
  }, [candidates.length]);

  // 选中候选项 → 返回要插入的文本和新光标位置
  const selectCandidate = useCallback(
    (index?: number): { newValue: string; newCursorPos: number } | null => {
      const idx = index ?? selectedIndex;
      const candidate = candidates[idx];
      if (!candidate) return null;

      const { triggerIndex } = mentionContext;
      const before = inputValue.slice(0, triggerIndex);
      const after = inputValue.slice(cursorPosition);

      if (candidate.type === "room") {
        const mention = "@全体 ";
        const newValue = before + mention + after;
        return { newValue, newCursorPos: before.length + mention.length };
      }

      // 用户 mention：插入内部格式 `[@displayName](userId) `
      const mention = `[@${candidate.member!.displayName}](${candidate.member!.userId}) `;
      const newValue = before + mention + after;
      return { newValue, newCursorPos: before.length + mention.length };
    },
    [candidates, selectedIndex, mentionContext, inputValue, cursorPosition],
  );

  return {
    isOpen: mentionContext.isOpen && candidates.length > 0,
    candidates,
    selectedIndex,
    navigateUp,
    navigateDown,
    selectCandidate,
  };
}
```

### 3.3 mentionParser.ts — 格式化与解析

```typescript
// packages/ui/src/lib/mentionParser.ts

/**
 * 内部 mention 格式: [@displayName](userId)
 * 如: [@alice](@alice:magic.com)
 * 全体: @全体
 */

const MENTION_REGEX = /\[@([^\]]+)\]\((@[^)]+)\)/g;
const ROOM_MENTION_REGEX = /@全体/g;

export interface ParsedMessage {
  /** 纯文本 body（Matrix 必须字段） */
  body: string;
  /** HTML formatted_body */
  formattedBody: string;
  /** m.mentions 字段 */
  mentions: {
    user_ids?: string[];
    room?: boolean;
  };
}

/**
 * 将编辑器内部格式转为 Matrix 消息格式。
 */
export function parseMentions(input: string, homeserver: string): ParsedMessage {
  const userIds: string[] = [];
  let hasRoomMention = false;

  // 纯文本 body：[@alice](@alice:magic.com) → @alice
  let body = input.replace(MENTION_REGEX, (_match, displayName, _userId) => {
    return `@${displayName}`;
  });

  // 检测 @全体
  if (ROOM_MENTION_REGEX.test(body)) {
    hasRoomMention = true;
    body = body.replace(ROOM_MENTION_REGEX, "@room");
  }

  // HTML formatted_body：插入 Matrix.to 链接
  let formattedBody = escapeHtml(input);
  formattedBody = formattedBody.replace(
    MENTION_REGEX,
    (_match, displayName, userId) => {
      userIds.push(userId);
      return `<a href="https://matrix.to/#/${encodeURIComponent(userId)}">${escapeHtml(displayName)}</a>`;
    },
  );

  if (hasRoomMention) {
    formattedBody = formattedBody.replace(
      /@全体/g,
      '@room',
    );
  }

  // 构建 m.mentions
  const mentions: ParsedMessage["mentions"] = {};
  if (userIds.length > 0) {
    mentions.user_ids = [...new Set(userIds)]; // 去重
  }
  if (hasRoomMention) {
    mentions.room = true;
  }

  return { body, formattedBody, mentions };
}

/**
 * 检查消息内容中是否有 mention 占位符。
 */
export function hasMentions(input: string): boolean {
  return MENTION_REGEX.test(input) || ROOM_MENTION_REGEX.test(input);
}

/**
 * 从 Matrix HTML formatted_body 中提取 mention 的 userId 列表。
 * 用于时间线渲染时识别提及。
 */
export function extractMentionedUserIds(formattedBody: string | undefined): string[] {
  if (!formattedBody) return [];
  const regex = /href="https:\/\/matrix\.to\/#\/(@[^"]+)"/g;
  const ids: string[] = [];
  let match;
  while ((match = regex.exec(formattedBody)) !== null) {
    ids.push(decodeURIComponent(match[1]));
  }
  return ids;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

### 3.4 MentionItem.tsx — 候选项

```tsx
// packages/ui/src/mentions/MentionItem.tsx
import { memo } from "react";
import { RoomAvatar } from "../rooms/RoomAvatar";
import { AgentStatusDot } from "../agents/AgentStatusDot";
import type { MentionCandidate } from "../hooks/useMentionAutocomplete";

interface MentionItemProps {
  candidate: MentionCandidate;
  isSelected: boolean;
  onSelect: () => void;
}

export const MentionItem = memo(function MentionItem({
  candidate,
  isSelected,
  onSelect,
}: MentionItemProps) {
  if (candidate.type === "room") {
    return (
      <button
        onClick={onSelect}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
          isSelected ? "bg-magic-primary/15" : "hover:bg-gray-800"
        }`}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-600/20 text-sm">
          📢
        </div>
        <div>
          <p className="text-sm font-medium text-white">@全体成员</p>
          <p className="text-xs text-gray-500">通知房间内所有人</p>
        </div>
      </button>
    );
  }

  const member = candidate.member!;

  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
        isSelected ? "bg-magic-primary/15" : "hover:bg-gray-800"
      }`}
    >
      {/* 头像 + Agent 状态点 */}
      <div className="relative">
        <RoomAvatar
          name={member.displayName}
          avatarMxc={member.avatarMxc}
          isDirect
          size={28}
        />
        {member.isAgent && member.agentStatus && (
          <span className="absolute -bottom-0.5 -right-0.5">
            <AgentStatusDot status={member.agentStatus} size="sm" />
          </span>
        )}
      </div>

      {/* 名称 + 标签 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-white">
            {member.displayName}
          </span>
          {member.isAgent && (
            <span className="shrink-0 rounded bg-magic-accent/20 px-1 py-0.5 text-[10px] font-medium text-magic-accent">
              Agent
            </span>
          )}
        </div>
        <p className="truncate text-xs text-gray-500">
          {member.userId}
          {member.agentRuntime ? ` · ${member.agentRuntime}` : ""}
        </p>
      </div>
    </button>
  );
});
```

### 3.5 MentionAutocomplete.tsx — 自动补全面板

```tsx
// packages/ui/src/mentions/MentionAutocomplete.tsx
import { useEffect, useRef } from "react";
import { MentionItem } from "./MentionItem";
import type { MentionCandidate } from "../hooks/useMentionAutocomplete";

interface MentionAutocompleteProps {
  isOpen: boolean;
  candidates: MentionCandidate[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function MentionAutocomplete({
  isOpen,
  candidates,
  selectedIndex,
  onSelect,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // 滚动到选中项
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen || candidates.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 max-h-52 overflow-y-auto
                 rounded-xl border border-gray-700 bg-magic-surface-alt shadow-xl"
      role="listbox"
    >
      {/* 标题 */}
      <div className="border-b border-gray-800 px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-wider text-gray-500">
          提及成员
        </span>
      </div>

      {/* 候选列表 */}
      {candidates.map((candidate, index) => (
        <MentionItem
          key={candidate.type === "room" ? "__room__" : candidate.member!.userId}
          candidate={candidate}
          isSelected={index === selectedIndex}
          onSelect={() => onSelect(index)}
        />
      ))}
    </div>
  );
}
```

### 3.6 MentionPill.tsx — 时间线中的提及标签

```tsx
// packages/ui/src/mentions/MentionPill.tsx
import { memo } from "react";
import { useAuthStore } from "@magic/matrix-client";

interface MentionPillProps {
  userId: string;
  displayName: string;
}

export const MentionPill = memo(function MentionPill({
  userId,
  displayName,
}: MentionPillProps) {
  const currentUserId = useAuthStore((s) => s.userId);
  const isMe = userId === currentUserId;

  return (
    <span
      className={`inline rounded px-1 py-0.5 text-sm font-medium cursor-pointer
                  transition-colors ${
        isMe
          ? "bg-magic-primary/25 text-magic-primary"       // 提及自己：蓝色高亮
          : "bg-gray-700/50 text-blue-300 hover:bg-gray-600/50"  // 提及他人
      }`}
      title={userId}
    >
      @{displayName}
    </span>
  );
});
```

### 3.7 更新 ComposerInput.tsx — @检测 + 自动补全

```tsx
// packages/ui/src/chat/ComposerInput.tsx（核心变更）

// 新增 Props：
interface ComposerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  roomId: string;                   // 新增：用于 mention
}

// 在组件内部：
export const ComposerInput = forwardRef<HTMLTextAreaElement, ComposerInputProps>(
  function ComposerInput({ value, onChange, onSend, disabled, placeholder, roomId }, ref) {
    const [cursorPosition, setCursorPosition] = useState(0);

    // mention 自动补全
    const {
      isOpen: mentionOpen,
      candidates,
      selectedIndex,
      navigateUp,
      navigateDown,
      selectCandidate,
    } = useMentionAutocomplete({
      roomId,
      inputValue: value,
      cursorPosition,
    });

    // 跟踪光标位置
    const handleSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      setCursorPosition((e.target as HTMLTextAreaElement).selectionStart);
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      setCursorPosition(e.target.selectionStart);
    }, [onChange]);

    // 键盘事件（扩展原有逻辑）
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // mention 自动补全激活时的键盘处理
        if (mentionOpen) {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            navigateUp();
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            navigateDown();
            return;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            const result = selectCandidate();
            if (result) {
              onChange(result.newValue);
              // 延迟设置光标位置
              requestAnimationFrame(() => {
                const textarea = textareaRef.current;
                if (textarea) {
                  textarea.selectionStart = result.newCursorPos;
                  textarea.selectionEnd = result.newCursorPos;
                  setCursorPosition(result.newCursorPos);
                }
              });
            }
            return;
          }
          if (e.key === "Escape") {
            // 关闭自动补全（通过清除触发条件——不需要额外 state）
            return;
          }
        }

        // 原有逻辑：Enter 发送、Shift+Enter 换行
        if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onSend();
          return;
        }
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onSend();
          return;
        }
      },
      [mentionOpen, navigateUp, navigateDown, selectCandidate, onChange, onSend],
    );

    return (
      <div className="relative flex-1">
        {/* 自动补全面板 */}
        <MentionAutocomplete
          isOpen={mentionOpen}
          candidates={candidates}
          selectedIndex={selectedIndex}
          onSelect={(index) => {
            const result = selectCandidate(index);
            if (result) {
              onChange(result.newValue);
              requestAnimationFrame(() => {
                const textarea = textareaRef.current;
                if (textarea) {
                  textarea.selectionStart = result.newCursorPos;
                  textarea.selectionEnd = result.newCursorPos;
                  setCursorPosition(result.newCursorPos);
                  textarea.focus();
                }
              });
            }
          }}
        />

        {/* textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onClick={handleSelect}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="w-full resize-none bg-transparent text-sm text-white
                     placeholder-gray-500 outline-none disabled:opacity-50"
          style={{
            minHeight: MIN_HEIGHT,
            maxHeight: MAX_HEIGHT,
            lineHeight: `${LINE_HEIGHT}px`,
          }}
        />
      </div>
    );
  },
);
```

### 3.8 更新 MessageComposer.tsx — 发送前解析 mention

```typescript
// packages/ui/src/hooks/useComposer.ts（更新 handleSend）

import { parseMentions, hasMentions } from "../lib/mentionParser";

// 在 handleSend 中替换发送逻辑：
const handleSend = useCallback(async () => {
  const text = value.trim();
  if (!text || isSending) return;

  setIsSending(true);
  stopTyping();

  try {
    if (hasMentions(text)) {
      // 有 mention → 解析并发送带 m.mentions 的消息
      const parsed = parseMentions(text, homeserver ?? "");
      const client = getClient();

      const content: Record<string, unknown> = {
        msgtype: "m.text",
        body: parsed.body,
        format: "org.matrix.custom.html",
        formatted_body: parsed.formattedBody,
        "m.mentions": parsed.mentions,
      };

      if (replyToEventId) {
        content["m.relates_to"] = {
          "m.in_reply_to": { event_id: replyToEventId },
        };
        setReplyTo(null);
      }

      await client.sendMessage(roomId, content);
    } else if (replyToEventId) {
      await sendReply(roomId, text, replyToEventId);
      setReplyTo(null);
    } else {
      await sendTextMessage(roomId, text);
    }

    setValue("");
    drafts.delete(roomId);
    inputRef.current?.focus();
  } catch (err) {
    console.error("发送消息失败:", err);
  } finally {
    setIsSending(false);
  }
}, [value, isSending, roomId, replyToEventId, setReplyTo, stopTyping, homeserver]);
```

### 3.9 更新 TextMessage.tsx — 渲染 MentionPill

```tsx
// packages/ui/src/chat/TextMessage.tsx（更新 react-markdown components）

import { MentionPill } from "../mentions/MentionPill";

// 在 ReactMarkdown 的 components.a 中处理 matrix.to 链接：
components={{
  a({ href, children }) {
    // 检测 Matrix.to mention 链接
    if (href?.startsWith("https://matrix.to/#/@")) {
      const userId = decodeURIComponent(href.replace("https://matrix.to/#/", ""));
      const displayName = typeof children === "string"
        ? children
        : (children as any)?.toString() ?? userId;
      return <MentionPill userId={userId} displayName={displayName} />;
    }
    // 普通链接
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  // ... 其他 components 不变
}}
```

### 3.10 更新 @magic/ui 导出

追加到 `packages/ui/src/index.ts`：

```typescript
// Mentions
export { MentionAutocomplete } from "./mentions/MentionAutocomplete";
export { MentionItem } from "./mentions/MentionItem";
export { MentionPill } from "./mentions/MentionPill";

// Hooks
export { useMentionAutocomplete } from "./hooks/useMentionAutocomplete";
export type { MentionCandidate } from "./hooks/useMentionAutocomplete";
export { useRoomMembers } from "./hooks/useRoomMembers";
export type { RoomMember } from "./hooks/useRoomMembers";

// Lib
export { parseMentions, hasMentions, extractMentionedUserIds } from "./lib/mentionParser";
```

---

## 4. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 输入 `@` 后弹出房间成员自动补全列表 | 手动验证 |
| AC-2 | 列表中 Agent 成员显示状态点（绿/黄/灰/红）和"Agent"标签 | 视觉检查 |
| AC-3 | 列表中真人成员显示头像和用户名 | 视觉检查 |
| AC-4 | 输入 `@ali` 后列表过滤仅显示名称含 "ali" 的成员 | 手动验证 |
| AC-5 | 方向键上下选择候选项，Enter 或 Tab 确认插入 | 手动验证 |
| AC-6 | 点击候选项也可插入 mention | 手动验证 |
| AC-7 | 插入后光标自动移到 mention 后面，继续输入不影响 mention | 手动验证 |
| AC-8 | 发送后对方客户端收到 `m.mentions` 字段，被提及者看到红色未读 badge | 从另一个客户端验证 |
| AC-9 | 时间线中 @mention 显示为蓝色高亮标签 | 视觉检查 |
| AC-10 | 提及自己时 MentionPill 使用更醒目的蓝色背景 | 视觉检查 |
| AC-11 | `@全体` 选项可用，发送后 `m.mentions.room = true` | 从另一个客户端验证 |
| AC-12 | Escape 键关闭自动补全面板 | 手动验证 |
| AC-13 | 一条消息中可以包含多个 @mention | 发送含 2+ 个 @ 的消息 |
| AC-14 | `pnpm typecheck` 全局通过 | `pnpm typecheck` |
| AC-15 | `pnpm test` 所有测试通过 | `pnpm test` |

---

## 5. 实现任务（按执行顺序）

### 任务 1：创建 mentionParser.ts 工具库

**创建文件**：`packages/ui/src/lib/mentionParser.ts`

**验证**：`pnpm typecheck`

---

### 任务 2：创建 useRoomMembers Hook

**创建文件**：`packages/ui/src/hooks/useRoomMembers.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：创建 useMentionAutocomplete Hook

**创建文件**：`packages/ui/src/hooks/useMentionAutocomplete.ts`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 MentionItem 和 MentionPill 组件

**创建文件**：
- `packages/ui/src/mentions/MentionItem.tsx`
- `packages/ui/src/mentions/MentionPill.tsx`

**验证**：`pnpm typecheck`

---

### 任务 5：创建 MentionAutocomplete 面板

**创建文件**：`packages/ui/src/mentions/MentionAutocomplete.tsx`

**验证**：`pnpm typecheck`

---

### 任务 6：更新 ComposerInput 集成 @检测 + 自动补全

**修改文件**：`packages/ui/src/chat/ComposerInput.tsx`

**验证**：`pnpm typecheck`

---

### 任务 7：更新 useComposer / MessageComposer 发送逻辑

**修改文件**：
- `packages/ui/src/hooks/useComposer.ts`（parseMentions 集成）
- `packages/ui/src/chat/MessageComposer.tsx`（传递 roomId 到 ComposerInput）

**验证**：`pnpm typecheck`

---

### 任务 8：更新 TextMessage 渲染 MentionPill

**修改文件**：`packages/ui/src/chat/TextMessage.tsx`

**验证**：`pnpm typecheck`

---

### 任务 9：更新 @magic/ui 导出

**修改文件**：`packages/ui/src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 10：编写单元测试

**创建文件**：
- `packages/ui/__tests__/lib/mentionParser.test.ts` — parseMentions 输入输出、多 mention、@全体、HTML 转义
- `packages/ui/__tests__/hooks/useMentionAutocomplete.test.ts` — @检测、过滤、导航、选择插入
- `packages/ui/__tests__/mentions/MentionPill.test.tsx` — 自己/他人样式区分

**验证**：`pnpm test`

---

### 任务 11：全局集成验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 输入@ → 选成员 → 发送 → 时间线高亮 → 对方收到通知
pnpm dev:web       # 同上
```

完成后提交：
```bash
git add -A
git commit -m "feat: 012 - @mention autocomplete with agent status, Matrix m.mentions"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| textarea 中无法真正实现 mention 的蓝色内联样式 | 输入框中 mention 看起来是纯文本 | MVP 阶段接受纯文本显示 `[@name](userId)` 格式；后续升级 Tiptap 可实现真正的内联标签 |
| 大房间（100+ 成员）自动补全卡顿 | 输入延迟 | 候选列表限制最多 10 项 + useMemo 缓存 |
| `m.mentions` 在旧版 homeserver 上不被识别 | 通知不触发 | Tuwunel 支持 Matrix v1.7+，`m.mentions` 已在规范中稳定；兼容性无问题 |
| 邮箱地址中的 @ 误触发自动补全 | 误弹面板 | 正则要求 @ 前面必须是空白或行首 |
| 回复 + mention 同时使用时消息格式复杂 | 格式错误 | useComposer 中 `m.relates_to` 和 `m.mentions` 独立处理，互不干扰 |

---

## 7. 后续 Spec 的接入点

- **后续通知 spec**：被 @mention 的消息触发桌面原生通知（通过 003 的 `notify:show` IPC）
- **后续 Tiptap 升级 spec**：替换 textarea 为 Tiptap，实现 mention 的蓝色内联标签（真正的 chip/pill 组件）、斜杠命令
- **后续 Profile 弹窗 spec**：点击 MentionPill 弹出用户/Agent 详情卡片
- **后续 @here spec**：增加 `@在线成员`（仅通知当前在线的成员）