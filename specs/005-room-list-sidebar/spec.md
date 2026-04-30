# Spec 005: 房间列表侧边栏（Room List Sidebar）

> 优先级: P0 | 波次: Wave 2 | 预估: 2-3 天 | 前置依赖: 002-matrix-sdk-wrapper, 004-auth-flow

---

## 1. 目标

替换 004 中 MainLayout 侧边栏的占位内容，实现完整的房间列表——支持按最近活动排序、未读数 badge、搜索过滤、DM（私聊）与群聊分组、加密房间标识、选中态高亮，以及创建/加入房间的入口。完成后，用户登录同步完成后可以在侧边栏看到所有房间并点击切换。

### 用户故事

- 作为用户，我希望同步完成后立刻看到所有已加入的房间，按最近消息时间倒序排列
- 作为用户，我希望未读房间显示未读计数 badge，有 @提及 时 badge 变为高亮色
- 作为用户，我希望点击房间后该房间高亮显示，右侧内容区切换到该房间
- 作为用户，我希望能通过搜索框快速过滤房间名称
- 作为用户，我希望私聊和群聊分组显示，方便区分
- 作为用户，我希望看到加密房间有一个锁图标标识
- 作为用户，我希望有一个"+"按钮可以创建新房间或加入已有房间

### 非目标（本 spec 不实现）

- Space（空间）层级导航 —— 后续 spec
- 房间拖拽排序 / 收藏置顶 —— 后续 spec
- 房间右键上下文菜单 —— 后续 spec

---

## 2. 架构设计

### 2.1 数据流

```
matrix-js-sdk (Room 事件)
      ↓ bridge.ts
useRoomStore (rooms, activeRoomId)
      ↓ React 订阅
RoomList → RoomSection → RoomListItem
```

### 2.2 排序与分组逻辑

1. **分组**：先按 `isDirect` 字段分为 "私聊" 和 "群聊" 两组
2. **组内排序**：按 `lastActivityTs` 降序（最新活动在前）
3. **未读置顶**：未读房间排在已读房间之前（同组内）
4. **搜索过滤**：输入时对 `room.name` 进行模糊匹配（大小写不敏感 + 拼音首字母可选）

### 2.3 文件结构

```
packages/ui/src/
├── rooms/
│   ├── RoomList.tsx           # 房间列表容器（搜索 + 分组 + 虚拟滚动）
│   ├── RoomSection.tsx        # 分组标题（私聊 / 群聊），可折叠
│   ├── RoomListItem.tsx       # 单个房间条目
│   ├── RoomAvatar.tsx         # 房间头像（MXC → HTTP + 默认字母头像）
│   ├── UnreadBadge.tsx        # 未读计数 badge
│   ├── RoomSearchInput.tsx    # 搜索输入框
│   ├── CreateRoomDialog.tsx   # 创建房间对话框
│   └── JoinRoomDialog.tsx     # 加入房间对话框
├── hooks/
│   └── useFilteredRooms.ts    # 搜索 + 排序 + 分组逻辑
└── layouts/
    └── MainLayout.tsx         # 更新：接入 RoomList
```

---

## 3. 技术规格

### 3.1 useFilteredRooms.ts — 搜索、排序、分组

```typescript
// packages/ui/src/hooks/useFilteredRooms.ts
import { useMemo, useState } from "react";
import { useRoomStore, type RoomData } from "@magic/matrix-client";

export interface RoomGroup {
  label: string;
  key: "dm" | "group";
  rooms: RoomData[];
  collapsed: boolean;
}

export function useFilteredRooms() {
  const rooms = useRoomStore((s) => s.rooms);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const allRooms = Object.values(rooms);

    // 搜索过滤
    const filtered = searchQuery.trim()
      ? allRooms.filter((r) =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : allRooms;

    // 分组
    const dms: RoomData[] = [];
    const groups: RoomData[] = [];
    for (const room of filtered) {
      if (room.isDirect) {
        dms.push(room);
      } else {
        groups.push(room);
      }
    }

    // 排序：未读优先 → 最近活动
    const sortFn = (a: RoomData, b: RoomData) => {
      // 未读优先
      const aUnread = a.unreadCount > 0 ? 1 : 0;
      const bUnread = b.unreadCount > 0 ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      // 最近活动
      return b.lastActivityTs - a.lastActivityTs;
    };

    dms.sort(sortFn);
    groups.sort(sortFn);

    const result: RoomGroup[] = [];

    if (dms.length > 0) {
      result.push({
        label: "私聊",
        key: "dm",
        rooms: dms,
        collapsed: collapsedSections["dm"] ?? false,
      });
    }

    if (groups.length > 0) {
      result.push({
        label: "群聊",
        key: "group",
        rooms: groups,
        collapsed: collapsedSections["group"] ?? false,
      });
    }

    return result;
  }, [rooms, searchQuery, collapsedSections]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const totalUnreadCount = useMemo(() => {
    return Object.values(rooms).reduce((sum, r) => sum + r.unreadCount, 0);
  }, [rooms]);

  return {
    groups,
    searchQuery,
    setSearchQuery,
    toggleSection,
    totalUnreadCount,
  };
}
```

### 3.2 RoomList.tsx — 房间列表容器

```tsx
// packages/ui/src/rooms/RoomList.tsx
import { useState } from "react";
import { useRoomStore } from "@magic/matrix-client";
import { useFilteredRooms } from "../hooks/useFilteredRooms";
import { RoomSection } from "./RoomSection";
import { RoomSearchInput } from "./RoomSearchInput";
import { CreateRoomDialog } from "./CreateRoomDialog";
import { JoinRoomDialog } from "./JoinRoomDialog";

export function RoomList() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const setActiveRoom = useRoomStore((s) => s.setActiveRoom);
  const { groups, searchQuery, setSearchQuery, toggleSection } = useFilteredRooms();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* 顶部：搜索 + 操作按钮 */}
      <div className="px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <RoomSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <button
            onClick={() => setShowCreateDialog(true)}
            className="shrink-0 rounded-lg p-1.5 text-gray-400
                       hover:bg-gray-700 hover:text-white transition-colors"
            title="创建房间"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      {/* 房间列表 */}
      <div className="flex-1 overflow-y-auto px-1.5">
        {groups.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-gray-500">
            {searchQuery ? "未找到匹配的房间" : "暂无房间"}
          </div>
        ) : (
          groups.map((group) => (
            <RoomSection
              key={group.key}
              label={group.label}
              rooms={group.rooms}
              collapsed={group.collapsed}
              onToggle={() => toggleSection(group.key)}
              activeRoomId={activeRoomId}
              onSelectRoom={setActiveRoom}
            />
          ))
        )}
      </div>

      {/* 对话框 */}
      {showCreateDialog && (
        <CreateRoomDialog onClose={() => setShowCreateDialog(false)} />
      )}
      {showJoinDialog && (
        <JoinRoomDialog onClose={() => setShowJoinDialog(false)} />
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
```

### 3.3 RoomSection.tsx — 可折叠分组

```tsx
// packages/ui/src/rooms/RoomSection.tsx
import { memo } from "react";
import { RoomListItem } from "./RoomListItem";
import type { RoomData } from "@magic/matrix-client";

interface RoomSectionProps {
  label: string;
  rooms: RoomData[];
  collapsed: boolean;
  onToggle: () => void;
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
}

export const RoomSection = memo(function RoomSection({
  label,
  rooms,
  collapsed,
  onToggle,
  activeRoomId,
  onSelectRoom,
}: RoomSectionProps) {
  return (
    <div className="mb-1">
      {/* 分组标题 */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs font-semibold
                   uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
      >
        <ChevronIcon collapsed={collapsed} />
        <span>{label}</span>
        <span className="ml-auto text-gray-600">{rooms.length}</span>
      </button>

      {/* 房间条目 */}
      {!collapsed && (
        <div className="space-y-0.5">
          {rooms.map((room) => (
            <RoomListItem
              key={room.roomId}
              room={room}
              isActive={room.roomId === activeRoomId}
              onSelect={() => onSelectRoom(room.roomId)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-90"}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
```

### 3.4 RoomListItem.tsx — 单个房间条目

```tsx
// packages/ui/src/rooms/RoomListItem.tsx
import { memo } from "react";
import { RoomAvatar } from "./RoomAvatar";
import { UnreadBadge } from "./UnreadBadge";
import type { RoomData } from "@magic/matrix-client";

interface RoomListItemProps {
  room: RoomData;
  isActive: boolean;
  onSelect: () => void;
}

export const RoomListItem = memo(function RoomListItem({
  room,
  isActive,
  onSelect,
}: RoomListItemProps) {
  const lastMessagePreview = room.lastMessage
    ? getMessagePreview(room.lastMessage)
    : null;

  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left
                  transition-colors ${
        isActive
          ? "bg-magic-primary/15 text-white"
          : "text-gray-300 hover:bg-gray-800"
      }`}
    >
      {/* 头像 */}
      <RoomAvatar
        name={room.name}
        avatarMxc={room.avatarMxc}
        isDirect={room.isDirect}
        size={36}
      />

      {/* 名称 + 最新消息预览 */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {room.isEncrypted && <LockIcon />}
          <span className={`truncate text-sm ${
            room.unreadCount > 0 ? "font-semibold text-white" : ""
          }`}>
            {room.name || "未命名房间"}
          </span>
        </div>
        {lastMessagePreview && (
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {lastMessagePreview}
          </p>
        )}
      </div>

      {/* 时间 + 未读 */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        {room.lastActivityTs > 0 && (
          <span className="text-[10px] text-gray-500">
            {formatRelativeTime(room.lastActivityTs)}
          </span>
        )}
        <UnreadBadge
          count={room.unreadCount}
          highlight={room.highlightCount > 0}
        />
      </div>
    </button>
  );
});

function LockIcon() {
  return (
    <svg className="h-3 w-3 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
    </svg>
  );
}

/**
 * 从最新消息中提取预览文本。
 */
function getMessagePreview(event: { content: Record<string, unknown>; sender: string }): string {
  const content = event.content;
  const msgtype = content.msgtype as string | undefined;
  const body = content.body as string | undefined;

  if (!msgtype) return "";

  switch (msgtype) {
    case "m.text":
      return body ?? "";
    case "m.image":
      return "📷 图片";
    case "m.file":
      return "📎 文件";
    case "m.video":
      return "🎬 视频";
    case "m.audio":
      return "🎵 音频";
    default:
      return body ?? "";
  }
}

/**
 * 将时间戳格式化为相对时间。
 */
function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  const date = new Date(ts);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
```

### 3.5 RoomAvatar.tsx — 房间头像

```tsx
// packages/ui/src/rooms/RoomAvatar.tsx
import { memo, useMemo } from "react";
import { mxcToHttp } from "@magic/matrix-client";

interface RoomAvatarProps {
  name: string;
  avatarMxc: string | null;
  isDirect?: boolean;
  size?: number;
}

export const RoomAvatar = memo(function RoomAvatar({
  name,
  avatarMxc,
  isDirect,
  size = 36,
}: RoomAvatarProps) {
  const avatarUrl = useMemo(() => {
    if (!avatarMxc) return null;
    return mxcToHttp(avatarMxc, size * 2, size * 2, "crop");
  }, [avatarMxc, size]);

  const initials = getInitials(name);
  const bgColor = getAvatarColor(name);

  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: isDirect ? "50%" : "8px",
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(e) => {
            // 图片加载失败时隐藏，显示下方的字母头像
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-white font-medium"
          style={{
            backgroundColor: bgColor,
            fontSize: size * 0.36,
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );
});

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/[\s_-]+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * 基于名称生成确定性的背景色。
 */
function getAvatarColor(name: string): string {
  const colors = [
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
```

### 3.6 UnreadBadge.tsx — 未读计数

```tsx
// packages/ui/src/rooms/UnreadBadge.tsx
import { memo } from "react";

interface UnreadBadgeProps {
  count: number;
  highlight?: boolean;
}

export const UnreadBadge = memo(function UnreadBadge({
  count,
  highlight = false,
}: UnreadBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : String(count);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-1.5
                  text-[10px] font-bold leading-4 text-white ${
        highlight
          ? "bg-red-500"         // @提及 → 红色
          : "bg-gray-600"        // 普通未读 → 灰色
      }`}
      style={{ minWidth: "18px" }}
    >
      {displayCount}
    </span>
  );
});
```

### 3.7 RoomSearchInput.tsx — 搜索输入

```tsx
// packages/ui/src/rooms/RoomSearchInput.tsx
import { useRef } from "react";

interface RoomSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function RoomSearchInput({ value, onChange }: RoomSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative flex-1">
      <SearchIcon />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜索房间…"
        className="w-full rounded-lg border border-gray-700 bg-magic-surface
                   py-1.5 pl-8 pr-3 text-sm text-white placeholder-gray-500
                   focus:border-magic-primary focus:outline-none focus:ring-1
                   focus:ring-magic-primary"
      />
      {value && (
        <button
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500
                     hover:text-gray-300"
        >
          <ClearIcon />
        </button>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
         fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
```

### 3.8 CreateRoomDialog.tsx — 创建房间对话框

```tsx
// packages/ui/src/rooms/CreateRoomDialog.tsx
import { useState, type FormEvent } from "react";
import { createRoom } from "@magic/matrix-client";

interface CreateRoomDialogProps {
  onClose: () => void;
}

export function CreateRoomDialog({ onClose }: CreateRoomDialogProps) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [encrypted, setEncrypted] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      await createRoom({
        name: name.trim(),
        topic: topic.trim() || undefined,
        encrypted,
      });
      onClose();
    } catch (err: any) {
      setError(err.message ?? "创建房间失败");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-magic-surface-alt p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">创建房间</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-gray-300">房间名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入房间名称"
              autoFocus
              disabled={isCreating}
              className="w-full rounded-lg border border-gray-700 bg-magic-surface
                         px-3 py-2 text-sm text-white placeholder-gray-500
                         focus:border-magic-primary focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-300">话题（可选）</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="房间话题描述"
              disabled={isCreating}
              className="w-full rounded-lg border border-gray-700 bg-magic-surface
                         px-3 py-2 text-sm text-white placeholder-gray-500
                         focus:border-magic-primary focus:outline-none disabled:opacity-50"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={encrypted}
              onChange={(e) => setEncrypted(e.target.checked)}
              disabled={isCreating}
              className="rounded border-gray-600 bg-magic-surface text-magic-primary
                         focus:ring-magic-primary"
            />
            启用端到端加密
          </label>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400
                         hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="rounded-lg bg-magic-primary px-4 py-1.5 text-sm font-medium
                         text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {isCreating ? "创建中…" : "创建"}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}
```

### 3.9 JoinRoomDialog.tsx — 加入房间对话框

```tsx
// packages/ui/src/rooms/JoinRoomDialog.tsx
import { useState, type FormEvent } from "react";
import { joinRoom } from "@magic/matrix-client";

interface JoinRoomDialogProps {
  onClose: () => void;
}

export function JoinRoomDialog({ onClose }: JoinRoomDialogProps) {
  const [roomIdOrAlias, setRoomIdOrAlias] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!roomIdOrAlias.trim()) return;

    setIsJoining(true);
    setError(null);

    try {
      await joinRoom(roomIdOrAlias.trim());
      onClose();
    } catch (err: any) {
      setError(err.message ?? "加入房间失败");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-magic-surface-alt p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">加入房间</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-gray-300">房间 ID 或别名</label>
            <input
              type="text"
              value={roomIdOrAlias}
              onChange={(e) => setRoomIdOrAlias(e.target.value)}
              placeholder="#room:magic.com 或 !abc:magic.com"
              autoFocus
              disabled={isJoining}
              className="w-full rounded-lg border border-gray-700 bg-magic-surface
                         px-3 py-2 text-sm text-white placeholder-gray-500
                         focus:border-magic-primary focus:outline-none disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isJoining}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400
                         hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isJoining || !roomIdOrAlias.trim()}
              className="rounded-lg bg-magic-primary px-4 py-1.5 text-sm font-medium
                         text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {isJoining ? "加入中…" : "加入"}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}
```

### 3.10 DialogOverlay.tsx — 对话框遮罩层

```tsx
// packages/ui/src/common/DialogOverlay.tsx
import { useEffect, type ReactNode } from "react";

interface DialogOverlayProps {
  children: ReactNode;
  onClose: () => void;
}

export function DialogOverlay({ children, onClose }: DialogOverlayProps) {
  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
```

### 3.11 更新 MainLayout.tsx — 接入 RoomList

```tsx
// packages/ui/src/layouts/MainLayout.tsx（更新）
import { useAuthStore } from "@magic/matrix-client";
import { useAuth } from "../hooks/useAuth";
import { RoomList } from "../rooms/RoomList";

export function MainLayout() {
  const { userId, homeserver } = useAuthStore();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-magic-surface text-white">
      {/* 侧边栏 */}
      <aside className="flex w-64 flex-col border-r border-gray-800 bg-magic-surface-alt">
        {/* 应用标题 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-bold tracking-wide">MAGIC</span>
        </div>

        {/* 房间列表 */}
        <div className="flex-1 min-h-0">
          <RoomList />
        </div>

        {/* 用户面板 */}
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

      {/* 主内容区（006-chat-timeline 填充） */}
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-medium text-gray-300">选择一个房间</h2>
          <p className="mt-2 text-sm text-gray-500">
            从左侧列表中选择一个房间开始聊天
          </p>
        </div>
      </main>
    </div>
  );
}
```

### 3.12 更新 @magic/ui 导出

追加到 `packages/ui/src/index.ts`：

```typescript
// Rooms
export { RoomList } from "./rooms/RoomList";
export { RoomSection } from "./rooms/RoomSection";
export { RoomListItem } from "./rooms/RoomListItem";
export { RoomAvatar } from "./rooms/RoomAvatar";
export { UnreadBadge } from "./rooms/UnreadBadge";
export { RoomSearchInput } from "./rooms/RoomSearchInput";
export { CreateRoomDialog } from "./rooms/CreateRoomDialog";
export { JoinRoomDialog } from "./rooms/JoinRoomDialog";

// Common
export { DialogOverlay } from "./common/DialogOverlay";

// Hooks
export { useFilteredRooms } from "./hooks/useFilteredRooms";
```

---

## 4. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 登录同步完成后侧边栏显示房间列表 | 连接有房间的 homeserver |
| AC-2 | 房间按最近活动排序，未读房间置顶 | 视觉检查 |
| AC-3 | 未读房间显示灰色 badge，有 @提及 时显示红色 badge | 视觉检查 |
| AC-4 | 点击房间后高亮（蓝色背景），`activeRoomId` 更新 | DevTools 检查 Zustand |
| AC-5 | 搜索框输入文字后实时过滤房间列表 | 手动验证 |
| AC-6 | 清空搜索框后恢复完整列表 | 手动验证 |
| AC-7 | 私聊和群聊分为两组，可折叠 | 手动验证 |
| AC-8 | 加密房间显示绿色锁图标 | 视觉检查 |
| AC-9 | 房间头像显示 MXC 图片或默认字母头像 | 视觉检查 |
| AC-10 | "创建房间"对话框可正常创建加密/非加密房间 | 手动验证 |
| AC-11 | "加入房间"对话框输入房间 ID/别名后可加入 | 手动验证 |
| AC-12 | 新消息到达时房间自动更新排序和预览 | 从另一个客户端发消息 |
| AC-13 | `pnpm typecheck` 全局通过 | `pnpm typecheck` |
| AC-14 | `pnpm test` 所有测试通过 | `pnpm test` |

---

## 5. 实现任务（按执行顺序）

### 任务 1：创建 DialogOverlay 通用组件

**创建文件**：
- `packages/ui/src/common/DialogOverlay.tsx`

**验证**：`pnpm typecheck`

---

### 任务 2：创建 RoomAvatar 和 UnreadBadge 基础组件

**创建文件**：
- `packages/ui/src/rooms/RoomAvatar.tsx`
- `packages/ui/src/rooms/UnreadBadge.tsx`

**验证**：`pnpm typecheck`

---

### 任务 3：创建 RoomListItem 组件

**创建文件**：
- `packages/ui/src/rooms/RoomListItem.tsx`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 RoomSection 和 RoomSearchInput

**创建文件**：
- `packages/ui/src/rooms/RoomSection.tsx`
- `packages/ui/src/rooms/RoomSearchInput.tsx`

**验证**：`pnpm typecheck`

---

### 任务 5：创建 useFilteredRooms Hook

**创建文件**：
- `packages/ui/src/hooks/useFilteredRooms.ts`

**验证**：`pnpm typecheck`

---

### 任务 6：创建 CreateRoomDialog 和 JoinRoomDialog

**创建文件**：
- `packages/ui/src/rooms/CreateRoomDialog.tsx`
- `packages/ui/src/rooms/JoinRoomDialog.tsx`

**验证**：`pnpm typecheck`

---

### 任务 7：创建 RoomList 容器组件

**创建文件**：
- `packages/ui/src/rooms/RoomList.tsx`

**验证**：`pnpm typecheck`

---

### 任务 8：更新 MainLayout 接入 RoomList

**修改文件**：
- `packages/ui/src/layouts/MainLayout.tsx`

**验证**：`pnpm dev:desktop`（侧边栏显示房间列表）

---

### 任务 9：更新 @magic/ui 导出

**修改文件**：
- `packages/ui/src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 10：编写单元测试

**创建文件**：
- `packages/ui/__tests__/rooms/RoomListItem.test.tsx` — 未读 badge、加密图标、消息预览
- `packages/ui/__tests__/rooms/UnreadBadge.test.tsx` — 数量显示、99+ 截断、高亮
- `packages/ui/__tests__/hooks/useFilteredRooms.test.ts` — 排序、分组、搜索过滤

**验证**：`pnpm test`

---

### 任务 11：全局集成验证

**验证**：
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 登录后侧边栏显示房间列表
pnpm dev:web       # 同上
```

完成后提交：
```bash
git add -A
git commit -m "feat: 005 - room list sidebar with search, grouping, unread badges"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 房间数量过多（>500）滚动卡顿 | 用户体验差 | 当前使用原生 overflow 滚动，如果出现性能问题在后续 spec 中引入 react-virtuoso |
| MXC 头像加载失败 | 空白头像 | `onError` 回退到字母头像 |
| `isDirect` 判断不准确 | DM 分组错误 | 使用 `room.getDMInviter()` 作为辅助判断 |
| 房间名为空 | 显示异常 | 回退到"未命名房间" |

---

## 7. 后续 Spec 的接入点

- **006-chat-timeline**：点击房间后在 MainLayout 的 `<main>` 区域渲染 ChatTimeline
- **007-message-composer**：在 ChatTimeline 底部嵌入消息编辑器
- **010-agent-status-dashboard**：在 RoomListItem 上显示 Agent 状态指示器
- **后续 Space spec**：在 RoomList 顶部增加 Space 切换栏