# Spec 013: UI 重构 — Discord 风格四栏布局

> 优先级: P0 | 波次: 立即执行 | 预估: 1-2 天 | 前置依赖: 001-monorepo-scaffold + 已有 UI 组件
> 文件路径: `specs/013-ui-restructure/spec.md`

---

## 1. 目标

将 MAGIC Client 的界面从当前的两栏布局（侧边栏 + 聊天区）重构为 Discord 2025 Onyx 风格的**四栏布局**（工作区栏 + 房间列表 + 聊天区 + 成员面板），同时将所有组件的样式对齐 `specs/shared/design-system.md` 定义的配色和交互规范。

### 当前状态 vs 目标状态

```
当前（两栏）:                    目标（四栏）:
┌──────────┬──────────┐        ┌────┬────────┬──────────────┬────────┐
│ 侧边栏    │ 聊天区    │   →   │工作 │ 房间    │   聊天区      │ 成员   │
│ 200px    │ 弹性     │        │区栏 │ 列表    │              │ 面板   │
│          │          │        │56px│ 200px  │   弹性        │ 200px  │
└──────────┴──────────┘        └────┴────────┴──────────────┴────────┘
```

---

## 2. 需要创建的新组件

### 2.1 WorkspaceBar.tsx — 工作区栏（最左侧 56px 竖条）

```tsx
// packages/ui/src/workspace/WorkspaceBar.tsx
import { useState } from "react";
import { WorkspaceIcon } from "./WorkspaceIcon";

interface Workspace {
  id: string;
  name: string;
  initial: string;
  color?: string;
}

const defaultWorkspaces: Workspace[] = [
  { id: "dm", name: "私聊", initial: "M", color: undefined },
  { id: "main", name: "Magic 工作区", initial: "✦", color: "#5865F2" },
];

export function WorkspaceBar() {
  const [activeId, setActiveId] = useState("main");

  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1.5 bg-[#1E1F22] py-2">
      {/* DM 入口 */}
      <WorkspaceIcon
        initial={defaultWorkspaces[0].initial}
        name={defaultWorkspaces[0].name}
        isActive={activeId === "dm"}
        onClick={() => setActiveId("dm")}
      />

      {/* 分隔线 */}
      <div className="mx-auto h-0.5 w-7 rounded-full bg-[#3F4147]" />

      {/* 工作区列表 */}
      {defaultWorkspaces.slice(1).map((ws) => (
        <WorkspaceIcon
          key={ws.id}
          initial={ws.initial}
          name={ws.name}
          color={ws.color}
          isActive={activeId === ws.id}
          onClick={() => setActiveId(ws.id)}
        />
      ))}

      {/* 分隔线 */}
      <div className="mx-auto h-0.5 w-7 rounded-full bg-[#3F4147]" />

      {/* 添加按钮 */}
      <WorkspaceIcon
        initial="+"
        name="添加工作区"
        variant="add"
        onClick={() => {}}
      />
    </div>
  );
}
```

### 2.2 WorkspaceIcon.tsx — 工作区图标（圆形↔方圆过渡）

```tsx
// packages/ui/src/workspace/WorkspaceIcon.tsx
import { memo } from "react";

interface WorkspaceIconProps {
  initial: string;
  name: string;
  color?: string;
  isActive?: boolean;
  hasNotification?: boolean;
  notificationCount?: number;
  variant?: "default" | "add";
  onClick: () => void;
}

export const WorkspaceIcon = memo(function WorkspaceIcon({
  initial,
  name,
  color,
  isActive = false,
  hasNotification = false,
  notificationCount,
  variant = "default",
  onClick,
}: WorkspaceIconProps) {
  return (
    <div className="relative flex items-center">
      {/* 左侧选中指示条 */}
      {isActive && (
        <div className="absolute -left-1 h-5 w-1 rounded-r-full bg-white" />
      )}
      {!isActive && hasNotification && (
        <div className="absolute -left-1 h-2 w-1 rounded-r-full bg-white" />
      )}

      <button
        onClick={onClick}
        title={name}
        className={`flex h-12 w-12 items-center justify-center text-base font-semibold
                    transition-all duration-200
                    ${isActive
                      ? "rounded-xl bg-[#5865F2] text-white"
                      : variant === "add"
                        ? "rounded-full border-[1.5px] border-dashed border-[#6D6F78] text-[#6D6F78] text-lg hover:rounded-xl hover:border-[#23A55A] hover:text-[#23A55A]"
                        : "rounded-full bg-[#313338] text-[#DBDEE1] hover:rounded-xl hover:bg-[#5865F2] hover:text-white"
                    }`}
        style={!isActive && color && variant !== "add" ? { backgroundColor: color, color: "#fff" } : undefined}
      >
        {initial}
      </button>

      {/* 通知角标 */}
      {notificationCount && notificationCount > 0 && (
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

### 2.3 ChannelHeader.tsx — Discord 风格聊天头部

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

  const toggleMembers = () => {
    if (rightPanelOpen) {
      closeRightPanel();
    } else {
      setRightPanel("members");
    }
  };

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[#1E1F22] px-3">
      {/* 频道标识 */}
      <span className="text-xl text-[#949BA4]">#</span>
      <span className="text-sm font-semibold text-[#DBDEE1]">
        {room.name || "未命名房间"}
      </span>

      {/* 竖线分隔 */}
      {room.topic && (
        <>
          <div className="mx-1.5 h-5 w-px bg-[#3F4147]" />
          <span className="flex-1 truncate text-xs text-[#949BA4]">
            {room.topic}
          </span>
        </>
      )}
      {!room.topic && <div className="flex-1" />}

      {/* 右侧图标栏 */}
      <div className="flex shrink-0 items-center gap-3">
        <HeaderIconButton
          title="Agent 面板"
          onClick={() => setRightPanel("agents")}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </HeaderIconButton>
        <HeaderIconButton title="搜索">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </HeaderIconButton>
        <HeaderIconButton
          title="成员列表"
          isActive={rightPanelOpen}
          onClick={toggleMembers}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        </HeaderIconButton>
      </div>
    </div>
  );
}

function HeaderIconButton({
  children,
  title,
  isActive,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`text-[#949BA4] transition-colors hover:text-[#DBDEE1]
                  ${isActive ? "text-[#DBDEE1]" : ""}`}
    >
      {children}
    </button>
  );
}
```

### 2.4 UserPanel.tsx — 底部用户面板

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
      {/* 头像 */}
      <div className="relative">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#5865F2] text-[11px] font-semibold text-white">
          {initials}
        </div>
        {/* 在线状态点 */}
        <div className="absolute -bottom-px -right-px flex h-3 w-3 items-center justify-center rounded-full bg-[#232428]">
          <div className="h-[7px] w-[7px] rounded-full bg-[#23A55A]" />
        </div>
      </div>

      {/* 用户信息 */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[#DBDEE1]">{displayName}</p>
        <p className="text-[10px] text-[#949BA4]">在线</p>
      </div>

      {/* 登出 */}
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

### 2.5 MemberPanel.tsx — 右侧成员面板

```tsx
// packages/ui/src/panels/MemberPanel.tsx
import { useRoomMembers, type RoomMember } from "../hooks/useRoomMembers";
import { RoomAvatar } from "../rooms/RoomAvatar";

interface MemberPanelProps {
  roomId: string;
}

export function MemberPanel({ roomId }: MemberPanelProps) {
  const members = useRoomMembers(roomId);

  const online = members.filter((m) => m.agentStatus === "active" || m.agentStatus === "idle" || !m.isAgent);
  const offline = members.filter((m) => m.isAgent && (m.agentStatus === "offline" || m.agentStatus === "error"));

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* 在线 */}
      {online.length > 0 && (
        <MemberSection label={`在线 — ${online.length}`} members={online} />
      )}
      {/* 离线 */}
      {offline.length > 0 && (
        <MemberSection label={`离线 — ${offline.length}`} members={offline} />
      )}
    </div>
  );
}

function MemberSection({ label, members }: { label: string; members: RoomMember[] }) {
  return (
    <div className="px-3 pt-4">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[#949BA4]">
        {label}
      </p>
      {members.map((m) => (
        <MemberItem key={m.userId} member={m} />
      ))}
    </div>
  );
}

function MemberItem({ member }: { member: RoomMember }) {
  const name = member.displayName;
  const statusColor = member.isAgent
    ? member.agentStatus === "active" ? "#23A55A"
      : member.agentStatus === "idle" ? "#F0B232"
      : member.agentStatus === "error" ? "#F23F43"
      : "#6D6F78"
    : "#23A55A";

  const runtimeTag = member.isAgent
    ? member.agentRuntime?.includes("hermes") ? { text: "HERMES", bg: "rgba(237,66,69,0.25)", color: "#F47B67" }
      : member.agentRuntime?.includes("qwenpaw") || member.agentRuntime?.includes("copaw")
        ? { text: "QWENPAW", bg: "rgba(35,165,90,0.25)", color: "#57F287" }
        : { text: "AGENT", bg: "rgba(88,101,242,0.25)", color: "#A5B0FC" }
    : null;

  return (
    <div className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#35373C]">
      {/* 头像 + 状态 */}
      <div className="relative">
        <RoomAvatar name={name} avatarMxc={member.avatarMxc} isDirect size={28} />
        <div className="absolute -bottom-px -right-px flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#2B2D31]">
          <div className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: statusColor }} />
        </div>
      </div>

      {/* 名称 + 标签 */}
      <span className="flex-1 truncate text-[12.5px] text-[#949BA4] group-hover:text-[#DBDEE1]">
        {name}
      </span>
      {runtimeTag && (
        <span
          className="shrink-0 rounded-sm px-1 py-px text-[8px] font-bold"
          style={{ backgroundColor: runtimeTag.bg, color: runtimeTag.color }}
        >
          {runtimeTag.text}
        </span>
      )}
    </div>
  );
}
```

---

## 3. 重构 MainLayout.tsx — 四栏布局

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
      {/* 第 1 栏：工作区栏 */}
      <WorkspaceBar />

      {/* 第 2 栏：房间列表 + 用户面板 */}
      <div className="flex w-[200px] shrink-0 flex-col bg-[#2B2D31]">
        {/* 头部 */}
        <div className="flex h-10 items-center border-b border-[#1E1F22] px-3">
          <span className="text-[13px] font-semibold text-[#DBDEE1]">Magic 工作区</span>
        </div>

        {/* 房间列表 */}
        <div className="min-h-0 flex-1">
          <RoomList />
        </div>

        {/* 用户面板 */}
        <UserPanel />
      </div>

      {/* 第 3 栏：聊天区 */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#313338]">
        <ChatView />
      </div>

      {/* 第 4 栏：右侧面板（可收起） */}
      {rightPanelOpen && activeRoomId && (
        <div className="flex w-[200px] shrink-0 flex-col border-l border-[#1E1F22] bg-[#2B2D31]">
          {/* 面板头部 */}
          <div className="flex h-10 items-center justify-between border-b border-[#1E1F22] px-3">
            <span className="text-[13px] font-semibold text-[#DBDEE1]">
              {rightPanelMode === "agents" ? "Agent 面板" : "成员"}
            </span>
            <button
              onClick={closeRightPanel}
              className="rounded p-0.5 text-[#949BA4] hover:text-[#DBDEE1]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 面板内容 */}
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

## 4. 更新现有组件样式

### 4.1 RoomList 样式更新要点

房间列表项从 `bg-magic-primary/15` 改为 Discord 风格：

```
默认:     文字 #949BA4,  背景 透明
悬浮:     文字 #DBDEE1,  背景 #35373C
选中:     文字 #FFFFFF,  背景 #404249
```

分类标题使用大写 + letter-spacing：
```
text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#949BA4]
```

### 4.2 MessageBubble 样式更新要点

**核心变更：取消气泡，改为 Discord 无气泡平铺**

```
之前：自己蓝色气泡靠右，他人灰色气泡靠左
之后：所有消息左对齐，头像 + 内容平铺，hover 整行 #35373C 背景
```

- 消息不再使用 `rounded-2xl` 背景色气泡
- 所有消息统一左对齐：头像 36px + 12px gap + 内容
- 发送者名称使用角色色（Agent 绿色、Hermes 珊瑚色等）
- hover 时整个消息组背景变为 `#35373C`

### 4.3 ChatView / ChatHeader 更新要点

用新的 `ChannelHeader` 替换现有 `ChatHeader`，样式对齐 Discord：
- `# 频道名` + 竖线分隔 + 话题 + 右侧图标栏
- 高度固定 40px
- 边框底部 `border-b border-[#1E1F22]`

### 4.4 编辑器样式更新

```
背景：#383A40（--bg-modifier）
圆角：8px
附件按钮 +：左侧，#949BA4，悬浮变 #DBDEE1
placeholder："发消息到 #频道名"
```

### 4.5 LoginPage 样式更新

- 全屏背景：`#1E1F22`（最深色）
- 登录卡片：`#2B2D31` 背景，`12px` 圆角
- 主按钮：`#5865F2` 背景，悬浮 `#4752C4`
- 输入框：`#1E1F22` 背景，`#3F4147` 边框

---

## 5. 更新 @magic/ui 导出

追加到 `packages/ui/src/index.ts`：

```typescript
// Workspace
export { WorkspaceBar } from "./workspace/WorkspaceBar";
export { WorkspaceIcon } from "./workspace/WorkspaceIcon";
export { UserPanel } from "./workspace/UserPanel";

// Panels
export { MemberPanel } from "./panels/MemberPanel";

// Chat (updated)
export { ChannelHeader } from "./chat/ChannelHeader";
```

---

## 6. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 界面呈现四栏布局：工作区栏(56px) + 房间列表(200px) + 聊天区(弹性) + 右侧面板(200px可收起) | 视觉检查 |
| AC-2 | 工作区图标默认圆形，悬浮时过渡为圆角方形（border-radius 50%→12px） | 悬浮测试 |
| AC-3 | 选中的工作区左侧显示白色指示条 | 视觉检查 |
| AC-4 | 房间列表项选中态为 `#404249` 灰色背景 + 白色文字（非蓝色） | 视觉检查 |
| AC-5 | 消息不使用气泡包裹，统一左对齐平铺 | 视觉检查 |
| AC-6 | 消息组 hover 时整行背景变为 `#35373C` | 悬浮测试 |
| AC-7 | Agent 名称使用角色色（绿色/珊瑚色/金色），并显示运行时标签 | 视觉检查 |
| AC-8 | 聊天头部显示 `# 频道名` + 话题 + 右侧图标 | 视觉检查 |
| AC-9 | 底部用户面板显示头像 + 名称 + 在线状态点 + 登出按钮 | 视觉检查 |
| AC-10 | 成员面板可通过头部按钮切换显示/隐藏 | 手动验证 |
| AC-11 | 整体配色为 Discord Onyx 暗色调（#1E1F22 / #2B2D31 / #313338） | 视觉检查 |
| AC-12 | `pnpm typecheck && pnpm build` 通过 | 命令验证 |

---

## 7. 实现任务（按执行顺序）

### 任务 1：创建 WorkspaceIcon 和 WorkspaceBar

**创建文件**：
- `packages/ui/src/workspace/WorkspaceIcon.tsx`
- `packages/ui/src/workspace/WorkspaceBar.tsx`

**验证**：`pnpm typecheck`

---

### 任务 2：创建 UserPanel

**创建文件**：
- `packages/ui/src/workspace/UserPanel.tsx`

**验证**：`pnpm typecheck`

---

### 任务 3：创建 ChannelHeader

**创建文件**：
- `packages/ui/src/chat/ChannelHeader.tsx`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 MemberPanel

**创建文件**：
- `packages/ui/src/panels/MemberPanel.tsx`

**验证**：`pnpm typecheck`

---

### 任务 5：重写 MainLayout 为四栏布局

**修改文件**：
- `packages/ui/src/layouts/MainLayout.tsx`（完全重写）

**验证**：`pnpm typecheck`

---

### 任务 6：更新 RoomList 相关组件样式

对齐 `RoomListItem`、`RoomSection`、`RoomSearchInput`、`UnreadBadge` 的配色为 Discord 风格。

**修改文件**：
- `packages/ui/src/rooms/RoomListItem.tsx` — 选中态改为灰色
- `packages/ui/src/rooms/RoomSection.tsx` — 分类标题大写样式
- `packages/ui/src/rooms/RoomSearchInput.tsx` — 输入框配色
- `packages/ui/src/rooms/UnreadBadge.tsx` — Badge 配色

**验证**：`pnpm typecheck`

---

### 任务 7：更新 MessageBubble 取消气泡

**修改文件**：
- `packages/ui/src/chat/MessageBubble.tsx` — 取消气泡包裹，统一左对齐平铺 + hover 行高亮

**验证**：`pnpm typecheck`

---

### 任务 8：更新 ChatView 使用 ChannelHeader

**修改文件**：
- `packages/ui/src/chat/ChatView.tsx` — 用 `ChannelHeader` 替换旧的 `ChatHeader`

**验证**：`pnpm typecheck`

---

### 任务 9：更新编辑器和登录页样式

**修改文件**：
- `packages/ui/src/chat/MessageComposer.tsx` — 编辑器配色
- `packages/ui/src/chat/ComposerInput.tsx` — 输入框配色
- `packages/ui/src/auth/LoginPage.tsx` — 登录页配色
- `packages/ui/src/auth/LoginForm.tsx` — 表单配色

**验证**：`pnpm typecheck`

---

### 任务 10：更新导出 + 全局验证

**修改文件**：
- `packages/ui/src/index.ts`（追加新组件导出）
- `apps/desktop/src/renderer/src/App.tsx`（确认引用更新后的 MainLayout）

**验证**：
```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm dev:desktop   # 四栏布局 + Discord 配色
pnpm dev:web       # 同上
```

完成后提交：
```bash
git add -A
git commit -m "feat: 013 - Discord Onyx style UI restructure with four-column layout"
```