# Spec 013: UI 重构 — Discord 风格四栏布局

> 优先级: P0 | 波次: 立即执行 | 预估: 1-2 天 | 前置依赖: 001-monorepo-scaffold + 已有 UI 组件
> 文件路径: `specs/013-ui-restructure/spec.md`

---

## 1. 目标

将 MAGIC Client 的界面重构为 Discord 2025 Onyx 风格的**四栏布局**，并将所有组件的**结构和样式**完全对齐 Discord。

### 核心变更清单

| # | 变更 | 原因 |
|---|------|------|
| 1 | MainLayout 从两栏变四栏 | 新增工作区栏 + 可收起成员面板 |
| 2 | RoomListItem 从 Element 风格改为 Discord 频道风格 | 去掉大头像、预览、时间戳；群聊用 `#` 前缀，私聊用状态点 |
| 3 | 分组标题从"群聊/私聊"改为"AGENT 团队/私聊" | 对齐 Agent 协同场景 |
| 4 | MessageBubble 取消气泡 | Discord 无气泡平铺 + hover 行高亮 |
| 5 | 成员面板用状态圆点替代对勾 + 增加运行时标签 | 对齐 Discord 成员列表 + Agent 特有标识 |
| 6 | 所有配色对齐 Discord Onyx 色板 | design-system.md 定义的颜色 |

---

## 2. 新增组件

### 2.1 WorkspaceBar.tsx — 工作区栏

```tsx
// packages/ui/src/workspace/WorkspaceBar.tsx
import { useState } from "react";
import { WorkspaceIcon } from "./WorkspaceIcon";

export function WorkspaceBar() {
  const [activeId, setActiveId] = useState("main");

  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1.5 bg-[#1E1F22] py-2">
      {/* DM 入口 */}
      <WorkspaceIcon
        initial="M"
        name="私聊"
        isActive={activeId === "dm"}
        onClick={() => setActiveId("dm")}
      />

      {/* 分隔线 */}
      <div className="mx-auto h-0.5 w-7 rounded-full bg-[#3F4147]" />

      {/* 主工作区 */}
      <WorkspaceIcon
        initial="✦"
        name="Magic 工作区"
        color="#5865F2"
        isActive={activeId === "main"}
        onClick={() => setActiveId("main")}
      />

      {/* 分隔线 */}
      <div className="mx-auto h-0.5 w-7 rounded-full bg-[#3F4147]" />

      {/* 添加按钮 — 48px 圆形虚线边框，无背景填充 */}
      <button
        title="添加工作区"
        className="flex h-12 w-12 items-center justify-center rounded-full
                   border-[1.5px] border-dashed border-[#6D6F78] text-lg text-[#6D6F78]
                   transition-all duration-200
                   hover:rounded-xl hover:border-[#23A55A] hover:text-[#23A55A]"
      >
        +
      </button>
    </div>
  );
}
```

### 2.2 WorkspaceIcon.tsx

```tsx
// packages/ui/src/workspace/WorkspaceIcon.tsx
import { memo } from "react";

interface WorkspaceIconProps {
  initial: string;
  name: string;
  color?: string;
  isActive?: boolean;
  notificationCount?: number;
  onClick: () => void;
}

export const WorkspaceIcon = memo(function WorkspaceIcon({
  initial,
  name,
  color,
  isActive = false,
  notificationCount,
  onClick,
}: WorkspaceIconProps) {
  return (
    <div className="relative flex items-center">
      {/* 左侧选中指示条 */}
      {isActive && (
        <div className="absolute -left-1 h-5 w-1 rounded-r-full bg-white" />
      )}

      <button
        onClick={onClick}
        title={name}
        className={`flex h-12 w-12 items-center justify-center text-base font-semibold
                    transition-all duration-200
                    ${isActive
                      ? "rounded-xl text-white"
                      : "rounded-full bg-[#313338] text-[#DBDEE1] hover:rounded-xl hover:bg-[#5865F2] hover:text-white"
                    }`}
        style={isActive
          ? { backgroundColor: color ?? "#5865F2" }
          : (!isActive && color ? { backgroundColor: color, color: "#fff" } : undefined)
        }
      >
        {initial}
      </button>

      {/* 通知角标 */}
      {notificationCount != null && notificationCount > 0 && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center
                         rounded-full bg-[#F23F43] px-1 text-[10px] font-bold text-white
                         ring-2 ring-[#1E1F22]">
          {notificationCount > 99 ? "99+" : notificationCount}
        </span>
      )}
    </div>
  );
});
```

### 2.3 UserPanel.tsx — 底部用户面板

```tsx
// packages/ui/src/workspace/UserPanel.tsx
import { useAuthStore } from "@magic/matrix-client";
import { useAuth } from "../hooks/useAuth";

export function UserPanel() {
  const { userId } = useAuthStore();
  const { logout } = useAuth();
  const displayName = userId?.match(/^@([^:]+)/)?.[1] ?? userId ?? "用户";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-2 bg-[#232428] px-2 py-1.5">
      <div className="relative">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5865F2] text-[11px] font-semibold text-white">
          {initials}
        </div>
        <div className="absolute -bottom-px -right-px flex h-3 w-3 items-center justify-center rounded-full bg-[#232428]">
          <div className="h-[7px] w-[7px] rounded-full bg-[#23A55A]" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[#DBDEE1]">{displayName}</p>
        <p className="text-[10px] text-[#949BA4]">在线</p>
      </div>
      <button
        onClick={logout}
        title="登出"
        className="rounded p-1 text-[#949BA4] transition-colors hover:bg-[#35373C] hover:text-[#DBDEE1]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
        </svg>
      </button>
    </div>
  );
}
```

### 2.4 ChannelHeader.tsx — Discord 风格聊天头部

```tsx
// packages/ui/src/chat/ChannelHeader.tsx
import { useRoomStore, useUIStore } from "@magic/matrix-client";

interface ChannelHeaderProps {
  roomId: string;
}

export function ChannelHeader({ roomId }: ChannelHeaderProps) {
  const room = useRoomStore((s) => s.rooms[roomId]);
  const { rightPanelOpen, setRightPanel, closeRightPanel } = useUIStore();
  if (!room) return null;

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[#1E1F22] px-3">
      <span className="text-xl text-[#949BA4]">#</span>
      <span className="text-sm font-semibold text-[#DBDEE1]">{room.name || "未命名房间"}</span>
      {room.topic && (
        <>
          <div className="mx-1.5 h-5 w-px bg-[#3F4147]" />
          <span className="flex-1 truncate text-xs text-[#949BA4]">{room.topic}</span>
        </>
      )}
      {!room.topic && <div className="flex-1" />}
      <div className="flex shrink-0 items-center gap-3 text-[#949BA4]">
        <button onClick={() => setRightPanel("agents")} title="Agent 面板"
                className="hover:text-[#DBDEE1] transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </button>
        <button title="搜索" className="hover:text-[#DBDEE1] transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </button>
        <button onClick={() => rightPanelOpen ? closeRightPanel() : setRightPanel("members")}
                title="成员列表"
                className={`transition-colors ${rightPanelOpen ? "text-[#DBDEE1]" : "hover:text-[#DBDEE1]"}`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

### 2.5 MemberPanel.tsx — 右侧成员面板（状态圆点，不是对勾 ✅）

```tsx
// packages/ui/src/panels/MemberPanel.tsx
import { useRoomMembers, type RoomMember } from "../hooks/useRoomMembers";
import { RoomAvatar } from "../rooms/RoomAvatar";

interface MemberPanelProps {
  roomId: string;
}

export function MemberPanel({ roomId }: MemberPanelProps) {
  const members = useRoomMembers(roomId);
  const online = members.filter((m) =>
    !m.isAgent || m.agentStatus === "active" || m.agentStatus === "idle"
  );
  const offline = members.filter((m) =>
    m.isAgent && (m.agentStatus === "offline" || m.agentStatus === "error")
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {online.length > 0 && <MemberSection label={`在线 — ${online.length}`} members={online} />}
      {offline.length > 0 && <MemberSection label={`离线 — ${offline.length}`} members={offline} />}
    </div>
  );
}

function MemberSection({ label, members }: { label: string; members: RoomMember[] }) {
  return (
    <div className="px-3 pt-4">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#949BA4]">
        {label}
      </p>
      {members.map((m) => <MemberItem key={m.userId} member={m} />)}
    </div>
  );
}

function MemberItem({ member }: { member: RoomMember }) {
  // ⚠️ 关键：用彩色小圆点表示状态，不用对勾 ✅
  const statusColor = member.isAgent
    ? member.agentStatus === "active" ? "#23A55A"
      : member.agentStatus === "idle" ? "#F0B232"
      : member.agentStatus === "error" ? "#F23F43"
      : "#6D6F78"
    : "#23A55A";

  // Agent 运行时标签
  const runtimeTag = member.isAgent
    ? member.agentRuntime?.includes("hermes")
        ? { text: "HERMES", bg: "rgba(237,66,69,0.25)", color: "#F47B67" }
      : member.agentRuntime?.includes("qwenpaw") || member.agentRuntime?.includes("copaw")
        ? { text: "QWENPAW", bg: "rgba(35,165,90,0.25)", color: "#57F287" }
        : { text: "AGENT", bg: "rgba(88,101,242,0.25)", color: "#A5B0FC" }
    : null;

  return (
    <div className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#35373C]">
      {/* 头像 + 右下角状态圆点 */}
      <div className="relative shrink-0">
        <RoomAvatar name={member.displayName} avatarMxc={member.avatarMxc} isDirect size={28} />
        {/* ⚠️ 这是彩色小圆点，不是对勾。外围描边环与面板背景同色 */}
        <div className="absolute -bottom-px -right-px flex h-[10px] w-[10px] items-center
                        justify-center rounded-full bg-[#2B2D31]">
          <div className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: statusColor }} />
        </div>
      </div>

      <span className="flex-1 truncate text-[12.5px] text-[#949BA4]">{member.displayName}</span>

      {/* Agent 运行时标签 */}
      {runtimeTag && (
        <span className="shrink-0 rounded-sm px-1 py-px text-[8px] font-bold"
              style={{ backgroundColor: runtimeTag.bg, color: runtimeTag.color }}>
          {runtimeTag.text}
        </span>
      )}
    </div>
  );
}
```

---

## 3. 重写 MainLayout.tsx — 四栏布局

```tsx
// packages/ui/src/layouts/MainLayout.tsx（完全重写）
import { useRoomStore, useUIStore } from "@magic/matrix-client";
import { WorkspaceBar } from "../workspace/WorkspaceBar";
import { RoomList } from "../rooms/RoomList";
import { UserPanel } from "../workspace/UserPanel";
import { ChatView } from "../chat/ChatView";
import { MemberPanel } from "../panels/MemberPanel";
import { AgentDashboard } from "../agents/AgentDashboard";

export function MainLayout() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const { rightPanelOpen, rightPanelMode, closeRightPanel } = useUIStore();

  return (
    <div className="flex h-screen bg-[#313338] text-[#DBDEE1]">
      <WorkspaceBar />

      <div className="flex w-[200px] shrink-0 flex-col bg-[#2B2D31]">
        <div className="flex h-10 items-center border-b border-[#1E1F22] px-3">
          <span className="text-[13px] font-semibold text-[#DBDEE1]">Magic 工作区</span>
        </div>
        <div className="min-h-0 flex-1"><RoomList /></div>
        <UserPanel />
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-[#313338]"><ChatView /></div>

      {rightPanelOpen && activeRoomId && (
        <div className="flex w-[200px] shrink-0 flex-col border-l border-[#1E1F22] bg-[#2B2D31]">
          <div className="flex h-10 items-center justify-between border-b border-[#1E1F22] px-3">
            <span className="text-[13px] font-semibold text-[#DBDEE1]">
              {rightPanelMode === "agents" ? "Agent 面板" : "成员"}
            </span>
            <button onClick={closeRightPanel} className="rounded p-0.5 text-[#949BA4] hover:text-[#DBDEE1]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rightPanelMode === "members" && <MemberPanel roomId={activeRoomId} />}
            {rightPanelMode === "agents" && <AgentDashboard roomId={activeRoomId} />}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 4. 重写现有组件

### 4.1 RoomListItem.tsx — Discord 频道风格（完全重写）

⚠️ **这是与当前 UI 差异最大的组件。必须完全重写，不是修改样式。**

```tsx
// packages/ui/src/rooms/RoomListItem.tsx（完全重写）
import { memo } from "react";
import { UnreadBadge } from "./UnreadBadge";
import type { RoomData } from "@magic/matrix-client";

interface RoomListItemProps {
  room: RoomData;
  isActive: boolean;
  onSelect: () => void;
}

/**
 * Discord 频道风格的房间列表项：
 * - 群聊：# + 房间名（单行，无头像、无预览、无时间戳）
 * - 私聊：● 状态圆点 + 用户名（单行）
 * - 高度 ~30px（不是 Element 风格的 ~56px）
 */
export const RoomListItem = memo(function RoomListItem({
  room,
  isActive,
  onSelect,
}: RoomListItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-1.5 rounded-md py-[5px] px-2.5 mx-1.5
                  text-left transition-colors duration-100
                  ${isActive
                    ? "bg-[#404249] text-white"
                    : room.unreadCount > 0
                      ? "text-[#DBDEE1] hover:bg-[#35373C]"
                      : "text-[#949BA4] hover:bg-[#35373C] hover:text-[#DBDEE1]"
                  }`}
    >
      {/* 前缀：群聊 = # 号，私聊 = 绿色状态圆点 */}
      {room.isDirect ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          <span className="h-2 w-2 rounded-full bg-[#23A55A]" />
        </span>
      ) : (
        <span className="w-4 shrink-0 text-center text-base leading-none opacity-60">#</span>
      )}

      {/* 房间名称 — 仅单行名称，不显示预览、不显示时间戳 */}
      <span className={`flex-1 truncate text-[13px]
                        ${room.unreadCount > 0 && !isActive ? "font-semibold" : ""}`}>
        {room.name || "未命名房间"}
      </span>

      {/* 未读 Badge（仅此一个附加元素） */}
      <UnreadBadge count={room.unreadCount} highlight={room.highlightCount > 0} />
    </button>
  );
});

// ⚠️ 以下内容已删除（与 Element 风格不同）：
// - 不 import RoomAvatar（不显示大彩色头像圆）
// - 不显示 getMessagePreview()（不显示消息预览）
// - 不显示 formatRelativeTime()（不显示时间戳）
// - 不显示加密锁图标（在 ChannelHeader 中显示）
```

### 4.2 RoomSection.tsx — 分类标题（完全重写）

```tsx
// packages/ui/src/rooms/RoomSection.tsx（完全重写）
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
  label, rooms, collapsed, onToggle, activeRoomId, onSelectRoom,
}: RoomSectionProps) {
  return (
    <div className="mb-0.5">
      {/* Discord 风格分类标题：大写、小字号、letter-spacing */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1 px-2.5 py-1.5
                   text-[10.5px] font-bold uppercase tracking-[0.04em]
                   text-[#949BA4] hover:text-[#DBDEE1] transition-colors"
      >
        <svg className={`h-2.5 w-2.5 transition-transform ${collapsed ? "" : "rotate-90"}`}
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>{label}</span>
      </button>

      {!collapsed && (
        <div className="space-y-px">
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
```

### 4.3 useFilteredRooms.ts — 分组名称修改

在 `packages/ui/src/hooks/useFilteredRooms.ts` 的 groups 构建逻辑中：

```typescript
// ⚠️ 将群聊（Agent 团队）放在前面，私聊放在后面

if (groups.length > 0) {
  result.push({
    label: "Agent 团队",    // ← 从 "群聊" 改为 "Agent 团队"
    key: "group",
    rooms: groups,
    collapsed: collapsedSections["group"] ?? false,
  });
}

if (dms.length > 0) {
  result.push({
    label: "私聊",
    key: "dm",
    rooms: dms,
    collapsed: collapsedSections["dm"] ?? false,
  });
}
```

### 4.4 UnreadBadge.tsx — 配色对齐

```tsx
// packages/ui/src/rooms/UnreadBadge.tsx（更新配色）
import { memo } from "react";

interface UnreadBadgeProps {
  count: number;
  highlight?: boolean;
}

export const UnreadBadge = memo(function UnreadBadge({ count, highlight = false }: UnreadBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-1
                  text-[10px] font-bold leading-none text-white
                  ${highlight ? "bg-[#F23F43]" : "bg-[#6D6F78]"}`}
      style={{ minWidth: "16px", height: "16px" }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
});
```

### 4.5 MessageBubble.tsx — 取消气泡（完全重写）

⚠️ **取消所有气泡相关样式，改为 Discord 无气泡平铺。**

```tsx
// packages/ui/src/chat/MessageBubble.tsx（完全重写）
import { memo } from "react";
import { RoomAvatar } from "../rooms/RoomAvatar";
import { MessageContent } from "./MessageContent";
import type { SerializedMatrixEvent } from "@magic/shared-types";

interface MessageBubbleProps {
  event: SerializedMatrixEvent;
  showSender: boolean;
  isOwn: boolean;
  onReply?: (eventId: string) => void;
}

export const MessageBubble = memo(function MessageBubble({
  event, showSender, isOwn, onReply,
}: MessageBubbleProps) {
  if (!event.type.startsWith("m.room.message")) {
    return <SystemEventLine event={event} />;
  }

  const senderName = extractDisplayName(event.sender);
  const roleColor = getRoleColor(event.sender);
  const time = formatTime(event.timestamp);

  return (
    <div className={`group relative flex gap-3 px-4 hover:bg-[#35373C]
                     ${showSender ? "mt-3 pt-0.5" : "mt-px"}`}>
      {/* 头像列 — showSender 时显示，否则留白对齐 */}
      <div className="w-9 shrink-0 pt-0.5">
        {showSender && (
          <RoomAvatar name={senderName} avatarMxc={null} isDirect size={36} />
        )}
      </div>

      {/* 内容列 — 无气泡包裹，直接平铺 */}
      <div className="min-w-0 flex-1">
        {showSender && (
          <div className="mb-0.5 flex items-baseline gap-1.5">
            <span className="text-[13px] font-semibold cursor-pointer hover:underline"
                  style={{ color: roleColor }}>
              {senderName}
            </span>
            <span className="text-[10.5px] text-[#6D6F78]">{time}</span>
          </div>
        )}
        <div className="text-[13.5px] leading-[1.45] text-[#DBDEE1]">
          <MessageContent event={event} isOwn={isOwn} />
        </div>
      </div>

      {/* 悬浮回复按钮 */}
      {onReply && (
        <div className="absolute right-4 -top-3 hidden group-hover:flex
                        items-center rounded-md border border-[#3F4147] bg-[#2B2D31] px-1 py-0.5 shadow-lg">
          <button onClick={() => onReply(event.eventId)}
                  className="rounded p-0.5 text-[#949BA4] hover:bg-[#35373C] hover:text-[#DBDEE1]" title="回复">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
});

// ⚠️ 以下内容已删除：
// - 不再有 isOwn 的右对齐逻辑（所有消息统一左对齐）
// - 不再有 rounded-2xl 背景色气泡
// - 不再有 bg-magic-primary / bg-magic-surface-alt 气泡颜色
// - 时间戳跟在发送者名后面（不在气泡下方）

function SystemEventLine({ event }: { event: SerializedMatrixEvent }) {
  const text = getSystemEventText(event);
  if (!text) return null;
  return (
    <div className="flex justify-center px-4 py-2">
      <span className="rounded-full bg-[#383A40]/50 px-3 py-1 text-xs text-[#949BA4]">{text}</span>
    </div>
  );
}

function getSystemEventText(event: SerializedMatrixEvent): string | null {
  const sender = extractDisplayName(event.sender);
  switch (event.type) {
    case "m.room.member": {
      const m = event.content.membership as string;
      if (m === "join") return `${sender} 加入了房间`;
      if (m === "leave") return `${sender} 离开了房间`;
      if (m === "invite") return `${sender} 被邀请加入`;
      return null;
    }
    case "m.room.topic": return `${sender} 更新了房间话题`;
    case "m.room.name": return `${sender} 更新了房间名称`;
    case "m.room.encryption": return "已启用端到端加密";
    default: return null;
  }
}

function extractDisplayName(userId: string): string {
  return userId.match(/^@([^:]+)/)?.[1] ?? userId;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 角色色：根据用户类型分配名称颜色 */
function getRoleColor(userId: string): string {
  const name = userId.toLowerCase();
  if (name.includes("hermes")) return "#F47B67";
  if (name.includes("worker") || name.includes("agent") || name.includes("alice") || name.includes("bob")) return "#57F287";
  if (name.includes("manager")) return "#1ABC9C";
  if (name.includes("admin")) return "#A5B0FC";
  return "#DBDEE1";
}
```

### 4.6 LoginPage + LoginForm 配色

修改 `packages/ui/src/auth/LoginPage.tsx`：
- 外层背景：`bg-[#1E1F22]`（最深色全屏）

修改 `packages/ui/src/auth/LoginForm.tsx`：
- 输入框：`bg-[#1E1F22] border-[#3F4147]`
- 主按钮：`bg-[#5865F2] hover:bg-[#4752C4]`

### 4.7 MessageComposer + ComposerInput 配色

修改 `packages/ui/src/chat/MessageComposer.tsx`：
- 编辑器容器：`bg-[#383A40] rounded-lg`

修改 `packages/ui/src/chat/ComposerInput.tsx`：
- placeholder：`text-[#6D6F78]`

### 4.8 ChatView — 用 ChannelHeader 替换旧 ChatHeader

修改 `packages/ui/src/chat/ChatView.tsx`：
- 将 `import { ChatHeader }` 替换为 `import { ChannelHeader }`
- 将 `<ChatHeader roomId={...} />` 替换为 `<ChannelHeader roomId={...} />`

---

## 5. 更新 @magic/ui 导出

追加到 `packages/ui/src/index.ts`：

```typescript
export { WorkspaceBar } from "./workspace/WorkspaceBar";
export { WorkspaceIcon } from "./workspace/WorkspaceIcon";
export { UserPanel } from "./workspace/UserPanel";
export { MemberPanel } from "./panels/MemberPanel";
export { ChannelHeader } from "./chat/ChannelHeader";
```

---

## 6. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 四栏布局：工作区栏(56px) + 房间列表(200px) + 聊天区(弹性) + 右侧面板(200px可收起) | 视觉检查 |
| AC-2 | 工作区图标默认圆形，悬浮过渡为 12px 圆角方形 | 悬浮测试 |
| AC-3 | 选中的工作区左侧显示白色指示条 | 视觉检查 |
| AC-4 | + 按钮为虚线圆形，悬浮变绿色圆角方形 | 悬浮测试 |
| AC-5 | **房间列表：群聊为 `#` + 名称（单行 ~30px），无大头像、无预览、无时间戳** | 视觉检查 |
| AC-6 | **房间列表：私聊为 8px 绿色状态圆点 + 用户名（单行 ~30px）** | 视觉检查 |
| AC-7 | 分组标题为 "▾ AGENT 团队" 和 "▾ 私聊"（10.5px 大写 tracking） | 视觉检查 |
| AC-8 | 选中房间为 #404249 灰色背景 + 白色文字 | 视觉检查 |
| AC-9 | **消息无气泡包裹，统一左对齐平铺，hover 整行 #35373C** | 视觉检查 |
| AC-10 | 发送者名称使用角色色（Agent 绿、Hermes 珊瑚、Manager 青） | 视觉检查 |
| AC-11 | **成员面板：头像右下角彩色小圆点（不是对勾 ✅），Agent 有 AGENT/HERMES 标签** | 视觉检查 |
| AC-12 | 聊天头部 `# 频道名` + 竖线 + 话题 + 右侧图标 | 视觉检查 |
| AC-13 | 底部用户面板：头像 + 名称 + 在线圆点 + 登出按钮 | 视觉检查 |
| AC-14 | `pnpm typecheck && pnpm build` 通过 | 命令验证 |

---

## 7. 实现任务（按执行顺序）

### 任务 1：创建 WorkspaceIcon 和 WorkspaceBar

**创建文件**：
- `packages/ui/src/workspace/WorkspaceIcon.tsx`（第 2.2 节代码）
- `packages/ui/src/workspace/WorkspaceBar.tsx`（第 2.1 节代码）

**验证**：`pnpm typecheck`

---

### 任务 2：创建 UserPanel

**创建文件**：`packages/ui/src/workspace/UserPanel.tsx`（第 2.3 节代码）

**验证**：`pnpm typecheck`

---

### 任务 3：创建 ChannelHeader

**创建文件**：`packages/ui/src/chat/ChannelHeader.tsx`（第 2.4 节代码）

**验证**：`pnpm typecheck`

---

### 任务 4：创建 MemberPanel（状态圆点 + 运行时标签）

**创建文件**：`packages/ui/src/panels/MemberPanel.tsx`（第 2.5 节代码）

⚠️ **注意**：在线状态用彩色小圆点（绿/黄/灰），不是对勾 ✅。圆点外围有与面板背景同色的描边环。

**验证**：`pnpm typecheck`

---

### 任务 5：重写 MainLayout 为四栏布局

**修改文件**：`packages/ui/src/layouts/MainLayout.tsx`（完全替换为第 3 节代码）

**验证**：`pnpm typecheck`

---

### 任务 6：重写 RoomListItem — Discord 频道风格

**修改文件**：`packages/ui/src/rooms/RoomListItem.tsx`（完全替换为第 4.1 节代码）

⚠️ **关键删除项**：
- 删除 `import { RoomAvatar }` — 不显示大彩色头像圆
- 删除 `getMessagePreview()` 函数 — 不显示消息预览
- 删除 `formatRelativeTime()` 函数 — 不显示时间戳
- 删除加密锁图标 — 在 ChannelHeader 中显示

**验证**：`pnpm typecheck`

---

### 任务 7：重写 RoomSection + 更新 useFilteredRooms

**修改文件**：
- `packages/ui/src/rooms/RoomSection.tsx`（完全替换为第 4.2 节代码）
- `packages/ui/src/hooks/useFilteredRooms.ts`（修改分组 label，第 4.3 节）

**验证**：`pnpm typecheck`

---

### 任务 8：重写 MessageBubble — 取消气泡

**修改文件**：`packages/ui/src/chat/MessageBubble.tsx`（完全替换为第 4.5 节代码）

⚠️ **关键删除项**：
- 删除 `isOwn` 右对齐逻辑
- 删除 `rounded-2xl` 气泡背景色
- 删除 `bg-magic-primary` / `bg-magic-surface-alt` 气泡颜色

**验证**：`pnpm typecheck`

---

### 任务 9：更新 ChatView + 编辑器 + 登录页 + UnreadBadge 配色

**修改文件**：
- `packages/ui/src/chat/ChatView.tsx`（ChannelHeader 替换 ChatHeader，第 4.8 节）
- `packages/ui/src/chat/MessageComposer.tsx`（配色，第 4.7 节）
- `packages/ui/src/chat/ComposerInput.tsx`（配色，第 4.7 节）
- `packages/ui/src/auth/LoginPage.tsx`（配色，第 4.6 节）
- `packages/ui/src/auth/LoginForm.tsx`（配色，第 4.6 节）
- `packages/ui/src/rooms/UnreadBadge.tsx`（替换为第 4.4 节代码）

**验证**：`pnpm typecheck`

---

### 任务 10：更新导出 + 全局验证

**修改文件**：`packages/ui/src/index.ts`（第 5 节）

**验证**：
```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm dev:desktop   # 应看到 Discord 四栏布局，# 频道风格房间列表，无气泡消息
pnpm dev:web       # 同上
```

完成后提交：
```bash
git add -A
git commit -m "feat: 013 - Discord Onyx style four-column layout with channel-style room list"
```