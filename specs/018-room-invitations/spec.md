# Spec 018: 房间邀请处理（Room Invitations）

> 优先级: P0 | 波次: Wave 5 | 预估: 2-3 天 | 前置依赖: 002-matrix-sdk-wrapper, 005-room-list-sidebar, 015-notifications-sound
> 文件路径: `specs/018-room-invitations/spec.md`

---

## 1. 目标

实现 Matrix 房间邀请的完整处理链路——收到邀请时在房间列表中显示邀请分组、弹出接受/拒绝对话框、发送桌面通知，以及可选的自动接受策略（来自 Manager 的邀请自动加入）。完成后，用户可以看到所有待处理的邀请并决定是否加入，HiClaw 场景下 Manager 创建的 Worker 房间会自动出现在房间列表中。

### Matrix 邀请机制简述

Matrix 房间的成员有四种状态（membership）：

| 状态 | 说明 |
|------|------|
| `invite` | 被邀请但尚未加入，房间出现在 `/sync` 的 `invite` 区 |
| `join` | 已加入，正常收发消息 |
| `leave` | 已离开或被踢出 |
| `ban` | 被封禁 |

用户收到邀请后必须主动 `join`（接受）或 `leave`（拒绝）。不处理则邀请一直挂着。

### 用户故事

- 作为用户，我希望收到房间邀请时在房间列表中看到"邀请"分组，显示待接受的房间列表
- 作为用户，我希望邀请房间右侧有信封图标标识，区别于已加入的房间
- 作为用户，我希望点击邀请房间后看到邀请详情（房间名、邀请者、Accept / Decline / Decline and Block）
- 作为用户，我希望点击 Accept 后自动加入房间并切换到该房间
- 作为用户，我希望点击 Decline 后邀请消失
- 作为用户，我希望收到邀请时有桌面通知提醒
- 作为用户，我希望来自 Manager 的邀请可以自动接受（可在设置中开关）
- 作为用户，我希望新登录验证提示（"New login. Was this you?"）也能正确显示和处理

### 非目标（本 spec 不实现）

- 主动邀请他人加入房间（已在 005 的 `inviteUser()` 中实现 API）
- 邀请链接 / 二维码邀请 —— 后续 spec
- 踢出 / 封禁成员 UI —— 后续 spec

---

## 2. 架构设计

### 2.1 数据流

```
Matrix homeserver 发送邀请
       ↓ /sync 响应中的 invite 区
matrix-js-sdk 触发 RoomEvent.MyMembership (membership = "invite")
       ↓ bridge.ts
inviteStore.addInvite()
       ↓ React 订阅
RoomList → InviteSection → InviteItem → 点击 → InviteDialog
       ↓ 用户决策
acceptInvite() / declineInvite()
       ↓
joinRoom() / leaveRoom() → 房间转为 joined / 消失
```

### 2.2 文件结构

```
packages/
├── matrix-client/src/
│   ├── stores/
│   │   └── inviteStore.ts           # 新增：邀请列表状态
│   ├── invites.ts                   # 新增：邀请接受/拒绝 API
│   └── bridge.ts                    # 更新：监听邀请事件
│
├── ui/src/
│   ├── rooms/
│   │   ├── RoomList.tsx             # 更新：增加邀请分组
│   │   ├── InviteSection.tsx        # 新增：邀请分组
│   │   └── InviteItem.tsx           # 新增：邀请房间条目
│   ├── invites/
│   │   ├── InviteDialog.tsx         # 新增：邀请详情对话框
│   │   └── InviteNotification.ts    # 新增：邀请桌面通知
│   └── hooks/
│       └── useAutoAccept.ts         # 新增：自动接受策略
```

---

## 3. 技术规格

### 3.1 inviteStore.ts — 邀请列表状态

```typescript
// packages/matrix-client/src/stores/inviteStore.ts
import { create } from "zustand";

export interface RoomInvite {
  /** 房间 ID */
  roomId: string;
  /** 房间名（邀请阶段可能只有部分信息） */
  roomName: string | null;
  /** 房间头像 MXC URI */
  roomAvatarMxc: string | null;
  /** 邀请者的 Matrix userId */
  inviterId: string;
  /** 邀请者显示名 */
  inviterName: string;
  /** 是否为私聊（DM） */
  isDirect: boolean;
  /** 是否加密房间 */
  isEncrypted: boolean;
  /** 邀请时间 */
  timestamp: number;
  /** 处理状态 */
  status: "pending" | "accepting" | "declining";
  /** 所属 session（多服务器支持） */
  sessionId: string;
}

interface InviteStoreState {
  /** roomId → RoomInvite */
  invites: Record<string, RoomInvite>;

  addInvite: (invite: RoomInvite) => void;
  removeInvite: (roomId: string) => void;
  updateInviteStatus: (roomId: string, status: RoomInvite["status"]) => void;
  getInvitesForSession: (sessionId: string) => RoomInvite[];
  getInviteCount: (sessionId?: string) => number;
  reset: () => void;
}

export const useInviteStore = create<InviteStoreState>((set, get) => ({
  invites: {},

  addInvite: (invite) => set((s) => ({
    invites: { ...s.invites, [invite.roomId]: invite },
  })),

  removeInvite: (roomId) => set((s) => {
    const { [roomId]: _, ...rest } = s.invites;
    return { invites: rest };
  }),

  updateInviteStatus: (roomId, status) => set((s) => ({
    invites: {
      ...s.invites,
      [roomId]: { ...s.invites[roomId], status },
    },
  })),

  getInvitesForSession: (sessionId) => {
    return Object.values(get().invites)
      .filter((inv) => inv.sessionId === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp);
  },

  getInviteCount: (sessionId) => {
    const invites = Object.values(get().invites);
    if (sessionId) return invites.filter((i) => i.sessionId === sessionId).length;
    return invites.length;
  },

  reset: () => set({ invites: {} }),
}));
```

### 3.2 invites.ts — 邀请接受/拒绝 API

```typescript
// packages/matrix-client/src/invites.ts
import { getClient } from "./client";
import { useInviteStore } from "./stores/inviteStore";
import { useRoomStore } from "./stores/roomStore";

/**
 * 接受房间邀请。
 * 调用 client.joinRoom() 后从 inviteStore 移除，房间会通过 sync 自动出现在 roomStore 中。
 */
export async function acceptInvite(roomId: string): Promise<void> {
  const inviteStore = useInviteStore.getState();
  inviteStore.updateInviteStatus(roomId, "accepting");

  try {
    const client = getClient();
    await client.joinRoom(roomId);
    inviteStore.removeInvite(roomId);
  } catch (err) {
    // 恢复状态
    inviteStore.updateInviteStatus(roomId, "pending");
    throw err;
  }
}

/**
 * 拒绝房间邀请。
 * 调用 client.leave() 拒绝邀请。
 */
export async function declineInvite(roomId: string): Promise<void> {
  const inviteStore = useInviteStore.getState();
  inviteStore.updateInviteStatus(roomId, "declining");

  try {
    const client = getClient();
    await client.leave(roomId);
    inviteStore.removeInvite(roomId);
  } catch (err) {
    inviteStore.updateInviteStatus(roomId, "pending");
    throw err;
  }
}

/**
 * 拒绝并屏蔽邀请者（阻止该用户再次邀请）。
 * 先 leave 再 ignore。
 */
export async function declineAndBlockInvite(roomId: string): Promise<void> {
  const inviteStore = useInviteStore.getState();
  const invite = inviteStore.invites[roomId];
  inviteStore.updateInviteStatus(roomId, "declining");

  try {
    const client = getClient();
    await client.leave(roomId);

    // 将邀请者加入 ignore 列表
    if (invite?.inviterId) {
      const ignoredUsers = client.getIgnoredUsers();
      if (!ignoredUsers.includes(invite.inviterId)) {
        await client.setIgnoredUsers([...ignoredUsers, invite.inviterId]);
      }
    }

    inviteStore.removeInvite(roomId);
  } catch (err) {
    inviteStore.updateInviteStatus(roomId, "pending");
    throw err;
  }
}

/**
 * 批量接受所有来自指定用户的邀请（如 Manager 的所有邀请）。
 */
export async function acceptAllInvitesFrom(inviterId: string): Promise<void> {
  const invites = Object.values(useInviteStore.getState().invites)
    .filter((inv) => inv.inviterId === inviterId && inv.status === "pending");

  for (const invite of invites) {
    try {
      await acceptInvite(invite.roomId);
    } catch (err) {
      console.error(`接受邀请 ${invite.roomId} 失败:`, err);
    }
  }
}
```

### 3.3 更新 bridge.ts — 监听邀请事件

```typescript
// packages/matrix-client/src/bridge.ts（追加到 bridgeToStores 函数内）

import { useInviteStore } from "./stores/inviteStore";

// ---- 房间邀请 ----
const onMembership = (room: Room, membership: string, prevMembership: string | undefined) => {
  if (membership === "invite") {
    // ⭐ 收到邀请 → 解析邀请信息并存入 inviteStore
    const invite = parseInvite(room, sessionId);
    if (invite) {
      useInviteStore.getState().addInvite(invite);

      // 触发通知回调
      inviteNotificationCallback?.(invite);
    }
  }

  if (prevMembership === "invite" && membership === "join") {
    // 邀请被接受（通过其他客户端或自动接受）→ 从 inviteStore 移除
    useInviteStore.getState().removeInvite(room.roomId);
  }

  if (membership === "leave") {
    // 离开房间 → 从 roomStore 移除
    useRoomStore.getState().removeRoom(sessionId, room.roomId);
    // 如果是邀请被拒绝 → 从 inviteStore 移除
    useInviteStore.getState().removeInvite(room.roomId);
  }
};
client.on(RoomEvent.MyMembership, onMembership);

/**
 * 从邀请阶段的 Room 对象解析邀请信息。
 * 邀请状态下 Room 只有部分信息（通过 invite_state 事件提供）。
 */
function parseInvite(room: Room, sessionId: string): RoomInvite | null {
  try {
    // 房间名：从 invite_state 的 m.room.name 事件获取
    const nameEvent = room.currentState.getStateEvents("m.room.name", "");
    const roomName = nameEvent?.getContent()?.name ?? null;

    // 房间头像
    const avatarEvent = room.currentState.getStateEvents("m.room.avatar", "");
    const roomAvatarMxc = avatarEvent?.getContent()?.url ?? null;

    // 邀请者：从 m.room.member 事件中找到 membership=invite 的发送者
    const memberEvents = room.currentState.getStateEvents("m.room.member");
    let inviterId = "";
    let inviterName = "";

    const myUserId = room.myUserId;
    for (const event of memberEvents) {
      if (event.getStateKey() === myUserId && event.getContent().membership === "invite") {
        inviterId = event.getSender() ?? "";
        // 邀请者的显示名需要从其 member 事件获取
        const inviterMember = room.currentState.getMember(inviterId);
        inviterName = inviterMember?.name ?? extractDisplayName(inviterId);
        break;
      }
    }

    // 是否加密
    const encryptionEvent = room.currentState.getStateEvents("m.room.encryption", "");
    const isEncrypted = !!encryptionEvent;

    // 是否 DM
    const isDirect = !!room.getDMInviter();

    return {
      roomId: room.roomId,
      roomName,
      roomAvatarMxc,
      inviterId,
      inviterName,
      isDirect,
      isEncrypted,
      timestamp: Date.now(),
      status: "pending",
      sessionId,
    };
  } catch (err) {
    console.error("解析邀请失败:", err);
    return null;
  }
}

function extractDisplayName(userId: string): string {
  return userId.match(/^@([^:]+)/)?.[1] ?? userId;
}

// ---- 邀请通知回调 ----
let inviteNotificationCallback: ((invite: RoomInvite) => void) | null = null;

export function registerInviteNotificationCallback(
  cb: (invite: RoomInvite) => void,
): void {
  inviteNotificationCallback = cb;
}
```

### 3.4 同步启动时加载已有邀请

```typescript
// packages/matrix-client/src/bridge.ts（追加到 syncRoomList 函数中）

/**
 * 在 PREPARED 后同步已有的邀请房间。
 * matrix-js-sdk 的 client.getRooms() 包含 membership=invite 的房间。
 */
function syncInviteList(client: MatrixClient, sessionId: string): void {
  const rooms = client.getRooms();
  for (const room of rooms) {
    const membership = room.getMyMembership();
    if (membership === "invite") {
      const invite = parseInvite(room, sessionId);
      if (invite) {
        useInviteStore.getState().addInvite(invite);
      }
    }
  }
}

// 在 onSync PREPARED 分支追加：
if (state === "PREPARED") {
  syncStore.setInitialSyncComplete();
  syncRoomList(client, sessionId);
  syncInviteList(client, sessionId);  // ⭐ 新增
}
```

### 3.5 InviteItem.tsx — 邀请房间条目

```tsx
// packages/ui/src/rooms/InviteItem.tsx
import { memo } from "react";
import type { RoomInvite } from "@magic/matrix-client";

interface InviteItemProps {
  invite: RoomInvite;
  onClick: () => void;
}

export const InviteItem = memo(function InviteItem({ invite, onClick }: InviteItemProps) {
  const displayName = invite.roomName
    ?? (invite.isDirect ? invite.inviterName : "未命名房间");

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-1.5 rounded-md py-[5px] px-2.5 mx-1.5
                 text-left text-[#949BA4] transition-colors duration-100
                 hover:bg-[#35373C] hover:text-[#DBDEE1]"
    >
      {/* 前缀：信封图标 */}
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#F0B232]">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      </span>

      {/* 房间名 */}
      <span className="flex-1 truncate text-[13px]">{displayName}</span>

      {/* 邀请状态指示 */}
      {invite.status === "accepting" && (
        <div className="h-3 w-3 animate-spin rounded-full border border-[#23A55A] border-t-transparent" />
      )}
      {invite.status === "declining" && (
        <div className="h-3 w-3 animate-spin rounded-full border border-[#F23F43] border-t-transparent" />
      )}
      {invite.status === "pending" && (
        <span className="shrink-0 rounded bg-[#F0B232]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#F0B232]">
          邀请
        </span>
      )}
    </button>
  );
});
```

### 3.6 InviteSection.tsx — 邀请分组

```tsx
// packages/ui/src/rooms/InviteSection.tsx
import { memo, useState } from "react";
import { InviteItem } from "./InviteItem";
import type { RoomInvite } from "@magic/matrix-client";

interface InviteSectionProps {
  invites: RoomInvite[];
  onSelectInvite: (invite: RoomInvite) => void;
}

export const InviteSection = memo(function InviteSection({
  invites,
  onSelectInvite,
}: InviteSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (invites.length === 0) return null;

  return (
    <div className="mb-0.5">
      {/* 分组标题 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-1 px-2.5 py-1.5
                   text-[10.5px] font-bold uppercase tracking-[0.04em]
                   text-[#F0B232] hover:text-[#DBDEE1] transition-colors"
      >
        <svg className={`h-2.5 w-2.5 transition-transform ${collapsed ? "" : "rotate-90"}`}
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>邀请</span>
        <span className="ml-1 rounded-full bg-[#F0B232]/20 px-1.5 py-0.5 text-[10px]">
          {invites.length}
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-px">
          {invites.map((invite) => (
            <InviteItem
              key={invite.roomId}
              invite={invite}
              onClick={() => onSelectInvite(invite)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
```

### 3.7 InviteDialog.tsx — 邀请详情对话框

```tsx
// packages/ui/src/invites/InviteDialog.tsx
import { useState } from "react";
import {
  acceptInvite,
  declineInvite,
  declineAndBlockInvite,
  useRoomStore,
  type RoomInvite,
} from "@magic/matrix-client";
import { DialogOverlay } from "../common/DialogOverlay";
import { RoomAvatar } from "../rooms/RoomAvatar";

interface InviteDialogProps {
  invite: RoomInvite;
  onClose: () => void;
}

export function InviteDialog({ invite, onClose }: InviteDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const displayName = invite.roomName
    ?? (invite.isDirect ? invite.inviterName : "未命名房间");
  const inviterShortName = invite.inviterName || invite.inviterId.match(/^@([^:]+)/)?.[1] || invite.inviterId;

  const handleAccept = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await acceptInvite(invite.roomId);
      // 加入成功 → 切换到该房间
      useRoomStore.getState().setActiveRoom(invite.roomId);
      onClose();
    } catch (err: any) {
      setError(err.message ?? "加入房间失败");
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await declineInvite(invite.roomId);
      onClose();
    } catch (err: any) {
      setError(err.message ?? "拒绝邀请失败");
      setIsProcessing(false);
    }
  };

  const handleBlock = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await declineAndBlockInvite(invite.roomId);
      onClose();
    } catch (err: any) {
      setError(err.message ?? "操作失败");
      setIsProcessing(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-[#313338] p-8 shadow-2xl text-center">
        {/* 标题 */}
        <h2 className="text-base font-semibold text-[#DBDEE1]">
          {invite.isDirect
            ? `${inviterShortName} 想与你私聊`
            : `是否加入 ${displayName}？`
          }
        </h2>

        {/* 房间头像 */}
        <div className="mt-4 flex justify-center">
          <RoomAvatar
            name={displayName}
            avatarMxc={invite.roomAvatarMxc}
            isDirect={invite.isDirect}
            size={48}
          />
        </div>

        {/* 邀请者信息 */}
        <p className="mt-3 text-sm text-[#949BA4]">
          邀请者 <span className="font-semibold text-[#DBDEE1]">{inviterShortName}</span>
        </p>
        <p className="text-xs text-[#6D6F78]">{invite.inviterId}</p>

        {/* 加密标识 */}
        {invite.isEncrypted && (
          <p className="mt-2 text-xs text-[#23A55A]">🔒 此房间已启用端到端加密</p>
        )}

        {/* 错误提示 */}
        {error && (
          <p className="mt-3 text-sm text-[#F23F43]">{error}</p>
        )}

        {/* 操作按钮 */}
        <div className="mt-6 space-y-2">
          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="w-full rounded-lg bg-[#5865F2] py-2 text-sm font-medium text-white
                       hover:bg-[#4752C4] disabled:opacity-50 transition-colors"
          >
            {isProcessing && invite.status === "accepting" ? "加入中…" : "接受"}
          </button>

          <button
            onClick={handleDecline}
            disabled={isProcessing}
            className="w-full rounded-lg py-2 text-sm font-medium text-[#DBDEE1]
                       hover:bg-[#35373C] disabled:opacity-50 transition-colors"
          >
            拒绝
          </button>

          <button
            onClick={handleBlock}
            disabled={isProcessing}
            className="w-full py-2 text-sm text-[#F23F43]
                       hover:underline disabled:opacity-50 transition-colors"
          >
            拒绝并屏蔽
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
```

### 3.8 useAutoAccept.ts — 自动接受策略

```typescript
// packages/ui/src/hooks/useAutoAccept.ts
import { useEffect } from "react";
import {
  registerInviteNotificationCallback,
  acceptInvite,
  useNotificationStore,
  type RoomInvite,
} from "@magic/matrix-client";
import { getAgentInfo } from "../lib/agentDetection";
import { evaluateInviteNotification } from "../invites/InviteNotification";

/**
 * 自动接受来自 Manager 的邀请（HiClaw 场景）。
 * 其他邀请触发桌面通知。
 *
 * 在 App.tsx 顶层调用一次。
 */
export function useAutoAccept(autoAcceptManager: boolean = true) {
  useEffect(() => {
    registerInviteNotificationCallback((invite: RoomInvite) => {
      const agentInfo = getAgentInfo(invite.inviterId);

      // 来自 Manager 的邀请 → 自动接受
      if (autoAcceptManager && agentInfo.isAgent && agentInfo.role === "manager") {
        acceptInvite(invite.roomId).catch((err) => {
          console.error("自动接受 Manager 邀请失败:", err);
        });
        return;
      }

      // 其他邀请 → 桌面通知
      evaluateInviteNotification(invite);
    });

    return () => {
      registerInviteNotificationCallback(() => {});
    };
  }, [autoAcceptManager]);
}
```

### 3.9 InviteNotification.ts — 邀请桌面通知

```typescript
// packages/ui/src/invites/InviteNotification.ts
import { useNotificationStore } from "@magic/matrix-client";
import type { RoomInvite } from "@magic/matrix-client";
import { isElectron } from "../hooks/useElectronAPI";
import { playMentionSound } from "../notifications/NotificationSound";

/**
 * 为邀请发送桌面通知。
 */
export function evaluateInviteNotification(invite: RoomInvite): void {
  const notifStore = useNotificationStore.getState();

  // DND 模式不通知
  if (notifStore.dnd) return;
  // 全局静音不通知
  if (notifStore.level === "mute") return;

  const inviterName = invite.inviterName || invite.inviterId;
  const roomName = invite.roomName ?? "未命名房间";

  const title = invite.isDirect
    ? `${inviterName} 想与你私聊`
    : `${inviterName} 邀请你加入 ${roomName}`;

  // 桌面通知
  if (isElectron()) {
    const electronAPI = (window as any).electronAPI;
    electronAPI?.showNotification?.({
      title,
      body: `来自 ${invite.inviterId}`,
      roomId: invite.roomId,
    });
  } else if ("Notification" in window && Notification.permission === "granted") {
    const notif = new Notification(title, {
      body: `来自 ${invite.inviterId}`,
      icon: "/favicon.ico",
      tag: `invite-${invite.roomId}`,
      silent: true,
    });
    notif.onclick = () => window.focus();
  }

  // 声音（使用 @提及声音，因为邀请是高优先级事件）
  if (notifStore.soundEnabled) {
    playMentionSound();
  }
}
```

### 3.10 更新 RoomList.tsx — 增加邀请分组

```tsx
// packages/ui/src/rooms/RoomList.tsx（追加邀请分组）

import { useState } from "react";
import { useRoomStore, useInviteStore, useSessionStore } from "@magic/matrix-client";
import type { RoomInvite } from "@magic/matrix-client";
import { useFilteredRooms } from "../hooks/useFilteredRooms";
import { RoomSection } from "./RoomSection";
import { InviteSection } from "./InviteSection";
import { InviteDialog } from "../invites/InviteDialog";
import { RoomSearchInput } from "./RoomSearchInput";
import { CreateRoomDialog } from "./CreateRoomDialog";

export function RoomList() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const setActiveRoom = useRoomStore((s) => s.setActiveRoom);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const { groups, searchQuery, setSearchQuery, toggleSection } = useFilteredRooms();

  // 邀请列表
  const invites = useInviteStore((s) =>
    activeSessionId ? s.getInvitesForSession(activeSessionId) : []
  );

  const [selectedInvite, setSelectedInvite] = useState<RoomInvite | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* 搜索 + 操作按钮 */}
      <div className="px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <RoomSearchInput value={searchQuery} onChange={setSearchQuery} />
          <button
            onClick={() => setShowCreateDialog(true)}
            className="shrink-0 rounded-lg p-1.5 text-[#949BA4]
                       hover:bg-[#35373C] hover:text-[#DBDEE1] transition-colors"
            title="创建房间"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      {/* 房间列表 */}
      <div className="flex-1 overflow-y-auto px-1.5">
        {/* ⭐ 邀请分组（最上方，黄色标题） */}
        <InviteSection
          invites={invites}
          onSelectInvite={(inv) => setSelectedInvite(inv)}
        />

        {/* 已加入的房间分组 */}
        {groups.length === 0 && invites.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-[#6D6F78]">
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

      {/* 邀请详情对话框 */}
      {selectedInvite && (
        <InviteDialog
          invite={selectedInvite}
          onClose={() => setSelectedInvite(null)}
        />
      )}

      {showCreateDialog && (
        <CreateRoomDialog onClose={() => setShowCreateDialog(false)} />
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

### 3.11 更新 App.tsx — 接入自动接受

```tsx
// apps/desktop/src/renderer/src/App.tsx（追加）
import { useAutoAccept } from "@magic/ui";

export default function App() {
  useNotifications();
  useAutoAccept(true);  // ⭐ 自动接受 Manager 邀请

  return (
    <AuthGuard>
      <MainLayout />
    </AuthGuard>
  );
}
```

---

## 4. 更新导出

**matrix-client/src/index.ts** 追加：
```typescript
export { useInviteStore } from "./stores/inviteStore";
export type { RoomInvite } from "./stores/inviteStore";
export { acceptInvite, declineInvite, declineAndBlockInvite, acceptAllInvitesFrom } from "./invites";
export { registerInviteNotificationCallback } from "./bridge";
```

**ui/src/index.ts** 追加：
```typescript
export { InviteSection } from "./rooms/InviteSection";
export { InviteItem } from "./rooms/InviteItem";
export { InviteDialog } from "./invites/InviteDialog";
export { useAutoAccept } from "./hooks/useAutoAccept";
```

---

## 5. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 收到邀请后房间列表顶部出现黄色"邀请"分组 | 从 Element 或 Manager 邀请 |
| AC-2 | 邀请房间显示信封图标 + 房间名 + 黄色"邀请"标签 | 视觉检查 |
| AC-3 | 点击邀请房间弹出对话框，显示房间名、邀请者、三个操作按钮 | 手动验证 |
| AC-4 | 点击"接受"后加入房间，自动切换到该房间，邀请从列表消失 | 手动验证 |
| AC-5 | 点击"拒绝"后邀请消失 | 手动验证 |
| AC-6 | 点击"拒绝并屏蔽"后邀请消失，该用户后续邀请不再出现 | 从同一用户再次邀请验证 |
| AC-7 | 加密房间邀请显示 🔒 标识 | 邀请加密房间 |
| AC-8 | 收到邀请时弹桌面通知 + 播放提示音 | 手动验证 |
| AC-9 | Manager 的邀请自动接受（autoAcceptManager = true） | Manager 创建 Worker 后验证 |
| AC-10 | 应用启动时同步已有的未处理邀请（不丢失） | 有未处理邀请时重启 |
| AC-11 | 处理中状态显示 spinner（accepting / declining） | 慢网络下观察 |
| AC-12 | DND 模式下邀请不弹通知 | 开启 DND 后收到邀请 |
| AC-13 | 多服务器场景下邀请按 sessionId 隔离 | 两个服务器各收到邀请 |
| AC-14 | `pnpm typecheck && pnpm build` 通过 | 命令验证 |

---

## 6. 实现任务（按执行顺序）

### 任务 1：创建 inviteStore

**创建文件**：`packages/matrix-client/src/stores/inviteStore.ts`

**修改文件**：
- `packages/matrix-client/src/stores/index.ts`
- `packages/matrix-client/src/index.ts`

**验证**：`pnpm typecheck`

---

### 任务 2：创建 invites.ts API

**创建文件**：`packages/matrix-client/src/invites.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：更新 bridge.ts — 监听邀请 + 初始加载

**修改文件**：`packages/matrix-client/src/bridge.ts`

**变更**：
- `onMembership` 中增加 `invite` 状态处理
- 新增 `parseInvite()` 函数
- 新增 `syncInviteList()` 在 PREPARED 后调用
- 新增 `registerInviteNotificationCallback()`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 InviteItem 和 InviteSection

**创建文件**：
- `packages/ui/src/rooms/InviteItem.tsx`
- `packages/ui/src/rooms/InviteSection.tsx`

**验证**：`pnpm typecheck`

---

### 任务 5：创建 InviteDialog

**创建文件**：`packages/ui/src/invites/InviteDialog.tsx`

**验证**：`pnpm typecheck`

---

### 任务 6：创建 InviteNotification + useAutoAccept

**创建文件**：
- `packages/ui/src/invites/InviteNotification.ts`
- `packages/ui/src/hooks/useAutoAccept.ts`

**验证**：`pnpm typecheck`

---

### 任务 7：更新 RoomList — 接入邀请分组

**修改文件**：`packages/ui/src/rooms/RoomList.tsx`

**验证**：`pnpm dev:desktop`（收到邀请后看到邀请分组）

---

### 任务 8：更新 App.tsx 接入 useAutoAccept

**修改文件**：
- `apps/desktop/src/renderer/src/App.tsx`
- `apps/web/src/App.tsx`

**验证**：`pnpm typecheck`

---

### 任务 9：更新导出

**修改文件**：
- `packages/matrix-client/src/index.ts`
- `packages/ui/src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 10：编写单元测试

**创建文件**：
- `packages/matrix-client/__tests__/stores/inviteStore.test.ts` — 增删邀请、session 过滤
- `packages/matrix-client/__tests__/invites.test.ts` — acceptInvite / declineInvite mock 测试
- `packages/ui/__tests__/invites/InviteDialog.test.tsx` — 三个按钮渲染和行为

**验证**：`pnpm test`

---

### 任务 11：全局集成验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 从 Element/Manager 邀请 → 看到邀请 → 接受/拒绝 → Manager 邀请自动接受
```

完成后提交：
```bash
git add -A
git commit -m "feat: 018 - room invitation handling with auto-accept for Manager"
```

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 邀请阶段 Room 对象信息不完整 | 房间名/头像可能为 null | `parseInvite` 中对所有字段做空值处理，UI 显示"未命名房间" |
| 自动接受 Manager 邀请的判断依赖 agentDetection | CRD API 未加载时判断不准 | 用户名模式匹配作为回退（`@manager:*` 开头） |
| `declineAndBlockInvite` 的 ignore 操作不可逆 | 用户误操作 | 对话框中"拒绝并屏蔽"用红色文字 + 需二次确认（后续可加） |
| 大量 Worker 同时创建导致邀请洪水 | 邀请列表很长 | 自动接受 Manager 邀请避免堆积；手动邀请列表支持折叠 |
| `client.getIgnoredUsers()` 可能需要额外同步 | 首次调用慢 | try-catch 包裹，失败时仅拒绝不屏蔽 |