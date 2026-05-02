# Spec 016: 多服务器管理与设置页面（Multi-Server & Settings）

> 优先级: P1 | 波次: Wave 5 | 预估: 4-5 天 | 前置依赖: 002-matrix-sdk-wrapper, 004-auth-flow, 013-ui-restructure, 015-notifications-sound
> 文件路径: `specs/016-settings-page/spec.md`

---

## 1. 目标

实现 MAGIC Client 的两个核心能力：**多 Matrix 服务器同时登录**（工作区栏每个图标 = 一个 Matrix homeserver 会话）和**统一设置页面**（Discord 风格全屏设置界面）。

### 核心概念

```
工作区栏的每个图标 = 一个 Matrix homeserver 的登录会话

┌────┐
│ M  │ ← matrix-local.hiclaw.io:18080（本地 HiClaw）
├────┤
│ D  │ ← dev.matrix.magic.com（开发环境）
├────┤
│ UI │ ← design.matrix.magic.com（设计团队）
├────┤
│ +  │ ← 点击添加新的 Matrix 服务器（弹出登录流程）
└────┘
```

用户可以同时登录多个 Matrix homeserver，每个 homeserver 有独立的房间列表、消息、成员。切换工作区图标 = 切换当前活跃的 homeserver 会话。

### 用户故事

**多服务器**：
- 作为用户，我希望同时登录多个 Matrix 服务器（如公司内网 HiClaw + 公共 matrix.org）
- 作为用户，我希望左侧工作区栏每个图标代表一个已登录的服务器
- 作为用户，我希望点击 `+` 按钮弹出登录界面，输入新服务器地址和账号密码后添加
- 作为用户，我希望切换工作区时房间列表、聊天区、成员面板全部切换到对应服务器
- 作为用户，我希望每个服务器独立显示未读角标
- 作为用户，我希望关闭应用重新打开时自动恢复所有已登录的服务器会话
- 作为用户，我希望可以断开（登出）某个服务器而不影响其他服务器

**首次欢迎界面**：
- 作为用户，我希望第一次打开应用时看到一个欢迎页面，引导我连接第一个 Matrix 服务器
- 作为用户，我希望欢迎页面上有服务器地址、用户名、密码输入框，一键连接
- 作为用户，我希望欢迎页面上有"快速连接"预置列表（如 HiClaw 本地、matrix.org），点击直接填充地址
- 作为用户，我希望连接成功后自动进入主界面，左侧栏出现第一个服务器图标

**设置页面**：
- 作为用户，我希望有统一的设置入口（用户面板齿轮按钮）
- 作为用户，我希望可以切换主题、语言、通知偏好、管理设备
- 作为用户，我希望可以查看和管理所有已登录的服务器

---

## 2. 架构设计

### 2.1 从单例到多实例：Session Manager

**当前架构（002 spec）**：
```
一个全局 MatrixClient 单例
↓
一套 Zustand stores（roomStore, syncStore, authStore ...）
```

**新架构**：
```
SessionManager 管理多个 Session
↓ 每个 Session 包含:
  ├── MatrixClient 实例
  ├── 独立的 roomStore 数据（存在 sessionStore 的 sessions[id].rooms 中）
  └── 独立的 syncState

全局 activeSessionId 决定 UI 当前显示哪个 Session 的数据
```

### 2.2 数据模型

```typescript
interface ServerSession {
  id: string;                    // 唯一标识（homeserver URL hash）
  homeserver: string;            // 如 "https://matrix-local.hiclaw.io:18080"
  userId: string;                // 如 "@admin:matrix-local.hiclaw.io"
  deviceId: string;
  accessToken: string;
  displayName: string | null;
  avatarMxc: string | null;
  serverName: string;            // 显示名（从 homeserver 域名提取或用户自定义）
  serverInitial: string;         // 图标文字（如 "M"）
  serverColor: string | null;    // 图标颜色
  syncState: SyncState;
  unreadCount: number;
  highlightCount: number;
  addedAt: number;               // 添加时间（决定排序）
}
```

### 2.3 文件结构

```
packages/
├── matrix-client/src/
│   ├── session-manager.ts          # 新增：多 Session 生命周期管理
│   └── stores/
│       └── sessionStore.ts         # 新增：多服务器会话状态
│
├── ui/src/
│   ├── auth/
│   │   ├── WelcomePage.tsx         # 新增：首次打开的欢迎引导页
│   │   └── AuthGuard.tsx           # 更新：无会话时显示 WelcomePage
│   ├── workspace/
│   │   ├── WorkspaceBar.tsx        # 重写：每个图标 = 一个服务器
│   │   ├── WorkspaceIcon.tsx       # 更新：显示服务器角标
│   │   ├── AddServerDialog.tsx     # 新增：添加服务器对话框
│   │   └── UserPanel.tsx           # 更新：齿轮按钮 + 当前服务器信息
│   ├── settings/
│   │   ├── SettingsPage.tsx        # 全屏设置页面
│   │   ├── SettingsNav.tsx         # 左侧导航
│   │   ├── SettingsSection.tsx     # 右侧内容容器
│   │   ├── sections/
│   │   │   ├── AccountSection.tsx
│   │   │   ├── ServersSection.tsx  # 新增：服务器管理
│   │   │   ├── AppearanceSection.tsx
│   │   │   ├── LanguageSection.tsx
│   │   │   └── SecuritySection.tsx
│   │   └── components/
│   │       ├── SettingsToggle.tsx
│   │       ├── SettingsRadioGroup.tsx
│   │       └── SettingsInput.tsx
│   └── hooks/
│       └── useSettings.ts
```

---

## 3. 技术规格

### 3.1 sessionStore.ts — 多服务器会话状态

```typescript
// packages/matrix-client/src/stores/sessionStore.ts
import { create } from "zustand";

export interface ServerSession {
  id: string;
  homeserver: string;
  userId: string;
  deviceId: string;
  accessToken: string;
  displayName: string | null;
  avatarMxc: string | null;
  serverName: string;
  serverInitial: string;
  serverColor: string | null;
  syncState: "STOPPED" | "SYNCING" | "PREPARED" | "ERROR" | "RECONNECTING";
  unreadCount: number;
  highlightCount: number;
  addedAt: number;
}

interface SessionStoreState {
  /** 所有已登录的服务器会话 */
  sessions: Record<string, ServerSession>;
  /** 当前活跃的会话 ID */
  activeSessionId: string | null;
  /** 是否正在添加新服务器 */
  isAddingServer: boolean;

  addSession: (session: ServerSession) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<ServerSession>) => void;
  setActiveSession: (id: string) => void;
  setIsAddingServer: (v: boolean) => void;

  getActiveSession: () => ServerSession | null;
  getSessionList: () => ServerSession[];
  reset: () => void;
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessions: {},
  activeSessionId: null,
  isAddingServer: false,

  addSession: (session) => set((s) => ({
    sessions: { ...s.sessions, [session.id]: session },
    activeSessionId: s.activeSessionId ?? session.id, // 第一个添加的自动激活
  })),

  removeSession: (id) => set((s) => {
    const { [id]: _, ...rest } = s.sessions;
    const newActive = s.activeSessionId === id
      ? Object.keys(rest)[0] ?? null
      : s.activeSessionId;
    return { sessions: rest, activeSessionId: newActive };
  }),

  updateSession: (id, updates) => set((s) => ({
    sessions: {
      ...s.sessions,
      [id]: { ...s.sessions[id], ...updates },
    },
  })),

  setActiveSession: (id) => set({ activeSessionId: id }),
  setIsAddingServer: (v) => set({ isAddingServer: v }),

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return activeSessionId ? sessions[activeSessionId] ?? null : null;
  },

  getSessionList: () => {
    return Object.values(get().sessions).sort((a, b) => a.addedAt - b.addedAt);
  },

  reset: () => set({ sessions: {}, activeSessionId: null, isAddingServer: false }),
}));
```

### 3.2 session-manager.ts — 多 Session 生命周期管理

```typescript
// packages/matrix-client/src/session-manager.ts
import { createClient, type MatrixClient } from "matrix-js-sdk";
import { useSessionStore, type ServerSession } from "./stores/sessionStore";
import { useRoomStore } from "./stores/roomStore";
import { useSyncStore } from "./stores/syncStore";
import { bridgeToStores } from "./bridge";

const SESSION_STORAGE_KEY = "magic_sessions";

/** sessionId → MatrixClient 实例 */
const clients = new Map<string, MatrixClient>();

/** sessionId → bridge cleanup 函数 */
const cleanups = new Map<string, () => void>();

/** sessionId → 该会话的 rooms 快照 */
const roomSnapshots = new Map<string, Record<string, any>>();

/**
 * 生成会话 ID（homeserver URL 的 hash）。
 */
export function createSessionId(homeserver: string): string {
  let hash = 0;
  for (let i = 0; i < homeserver.length; i++) {
    hash = ((hash << 5) - hash) + homeserver.charCodeAt(i);
    hash |= 0;
  }
  return `session_${Math.abs(hash).toString(36)}`;
}

/**
 * 登录新的 Matrix 服务器并添加为工作区。
 */
export async function addServer(
  homeserver: string,
  username: string,
  password: string,
): Promise<string> {
  const sessionId = createSessionId(homeserver);
  const store = useSessionStore.getState();

  // 已存在则直接切换
  if (store.sessions[sessionId]) {
    store.setActiveSession(sessionId);
    return sessionId;
  }

  // 创建客户端
  const client = createClient({ baseUrl: homeserver, timelineSupport: true, useAuthorizationHeader: true });

  // 登录
  const response = await client.loginWithPassword(username, password);

  // 初始化加密
  await client.initRustCrypto();

  // 保存客户端实例
  clients.set(sessionId, client);

  // 构建 session 数据
  const domain = new URL(homeserver).hostname;
  const serverName = domain.split(".")[0] || domain;
  const session: ServerSession = {
    id: sessionId,
    homeserver,
    userId: response.user_id,
    deviceId: response.device_id,
    accessToken: response.access_token,
    displayName: null,
    avatarMxc: null,
    serverName,
    serverInitial: serverName.charAt(0).toUpperCase(),
    serverColor: generateColor(homeserver),
    syncState: "STOPPED",
    unreadCount: 0,
    highlightCount: 0,
    addedAt: Date.now(),
  };

  store.addSession(session);

  // 启动同步 + 桥接
  await startSessionSync(sessionId);

  // 持久化
  persistSessions();

  return sessionId;
}

/**
 * 启动某个会话的同步。
 */
async function startSessionSync(sessionId: string): Promise<void> {
  const client = clients.get(sessionId);
  if (!client) return;

  // 桥接事件到 stores
  const cleanup = bridgeToStores(client);
  cleanups.set(sessionId, cleanup);

  // 监听同步状态
  client.on("sync" as any, (state: string) => {
    useSessionStore.getState().updateSession(sessionId, {
      syncState: state as ServerSession["syncState"],
    });
  });

  await client.startClient({ initialSyncLimit: 20, lazyLoadMembers: true });
}

/**
 * 切换活跃会话。
 * 保存当前会话的 rooms 快照 → 恢复目标会话的 rooms 快照。
 */
export function switchSession(targetSessionId: string): void {
  const store = useSessionStore.getState();
  const currentId = store.activeSessionId;

  if (currentId === targetSessionId) return;

  // 保存当前会话的 roomStore 快照
  if (currentId) {
    roomSnapshots.set(currentId, { ...useRoomStore.getState().rooms });
  }

  // 切换活跃会话
  store.setActiveSession(targetSessionId);

  // 恢复目标会话的 roomStore
  const targetRooms = roomSnapshots.get(targetSessionId) ?? {};
  useRoomStore.setState({ rooms: targetRooms, activeRoomId: null });

  // 重建 roomStore（从 MatrixClient 同步）
  const client = clients.get(targetSessionId);
  if (client) {
    const rooms = client.getRooms();
    for (const room of rooms) {
      useRoomStore.getState().upsertRoom(room.roomId, {
        name: room.name,
        topic: room.currentState.getStateEvents("m.room.topic", "")?.getContent()?.topic ?? "",
        memberCount: room.getJoinedMemberCount(),
        unreadCount: room.getUnreadNotificationCount("total") ?? 0,
        highlightCount: room.getUnreadNotificationCount("highlight") ?? 0,
        isEncrypted: room.hasEncryptionStateEvent(),
        isDirect: !!room.getDMInviter(),
        lastActivityTs: room.getLastActiveTimestamp(),
      });
    }
  }
}

/**
 * 登出某个服务器。
 */
export async function removeServer(sessionId: string): Promise<void> {
  const client = clients.get(sessionId);
  if (client) {
    try { await client.logout(true); } catch {}
    client.stopClient();
    client.removeAllListeners();
  }

  cleanups.get(sessionId)?.();
  clients.delete(sessionId);
  cleanups.delete(sessionId);
  roomSnapshots.delete(sessionId);

  useSessionStore.getState().removeSession(sessionId);
  persistSessions();
}

/**
 * 获取指定会话的 MatrixClient。
 */
export function getSessionClient(sessionId?: string): MatrixClient | null {
  const id = sessionId ?? useSessionStore.getState().activeSessionId;
  return id ? clients.get(id) ?? null : null;
}

/**
 * 应用启动时恢复所有已保存的会话。
 */
export async function restoreAllSessions(): Promise<void> {
  const saved = loadPersistedSessions();
  if (saved.length === 0) return;

  for (const session of saved) {
    try {
      const client = createClient({
        baseUrl: session.homeserver,
        accessToken: session.accessToken,
        userId: session.userId,
        deviceId: session.deviceId,
        timelineSupport: true,
        useAuthorizationHeader: true,
      });

      await client.initRustCrypto();
      clients.set(session.id, client);
      useSessionStore.getState().addSession(session);
      await startSessionSync(session.id);
    } catch (err) {
      console.error(`恢复会话 ${session.serverName} 失败:`, err);
    }
  }
}

// ---- 持久化 ----

function persistSessions(): void {
  try {
    const sessions = Object.values(useSessionStore.getState().sessions).map((s) => ({
      id: s.id,
      homeserver: s.homeserver,
      userId: s.userId,
      deviceId: s.deviceId,
      accessToken: s.accessToken,
      serverName: s.serverName,
      serverInitial: s.serverInitial,
      serverColor: s.serverColor,
      addedAt: s.addedAt,
    }));
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  } catch {}
}

function loadPersistedSessions(): ServerSession[] {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((s: any): ServerSession => ({
      ...s,
      displayName: null,
      avatarMxc: null,
      syncState: "STOPPED",
      unreadCount: 0,
      highlightCount: 0,
    }));
  } catch {
    return [];
  }
}

function generateColor(input: string): string {
  const colors = ["#5865F2", "#23A55A", "#F0B232", "#EB459E", "#ED4245", "#57F287", "#FEE75C"];
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = input.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
```

### 3.3 AddServerDialog.tsx — 添加服务器对话框

```tsx
// packages/ui/src/workspace/AddServerDialog.tsx
import { useState, type FormEvent } from "react";
import { addServer } from "@magic/matrix-client";
import { DialogOverlay } from "../common/DialogOverlay";

interface AddServerDialogProps {
  onClose: () => void;
}

export function AddServerDialog({ onClose }: AddServerDialogProps) {
  const [homeserver, setHomeserver] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!homeserver.trim() || !username.trim() || !password.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await addServer(homeserver.trim(), username.trim(), password);
      onClose();
    } catch (err: any) {
      setError(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-[#313338] p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-[#DBDEE1]">添加 Matrix 服务器</h2>
        <p className="mt-1 text-xs text-[#949BA4]">
          登录一个新的 Matrix homeserver，它会作为独立的工作区出现在左侧栏中
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-[#949BA4]">服务器地址</label>
            <input
              type="url"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              placeholder="https://matrix.example.com"
              autoFocus
              disabled={isLoading}
              className="w-full rounded-lg border border-[#3F4147] bg-[#1E1F22]
                         px-3 py-2 text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                         focus:border-[#5865F2] focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[#949BA4]">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@user:example.com 或 user"
              disabled={isLoading}
              autoComplete="username"
              className="w-full rounded-lg border border-[#3F4147] bg-[#1E1F22]
                         px-3 py-2 text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                         focus:border-[#5865F2] focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[#949BA4]">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              disabled={isLoading}
              autoComplete="current-password"
              className="w-full rounded-lg border border-[#3F4147] bg-[#1E1F22]
                         px-3 py-2 text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                         focus:border-[#5865F2] focus:outline-none disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-[#F23F43]">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isLoading}
                    className="rounded-lg px-3 py-1.5 text-sm text-[#949BA4] hover:text-[#DBDEE1]">
              取消
            </button>
            <button type="submit"
                    disabled={isLoading || !homeserver.trim() || !username.trim() || !password.trim()}
                    className="rounded-lg bg-[#5865F2] px-4 py-1.5 text-sm font-medium text-white
                               hover:bg-[#4752C4] disabled:opacity-50 transition-colors">
              {isLoading ? "连接中…" : "添加服务器"}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}

function parseError(err: any): string {
  const msg = err?.message ?? String(err);
  if (msg.includes("M_FORBIDDEN")) return "用户名或密码错误";
  if (msg.includes("fetch") || msg.includes("network")) return "无法连接到服务器，请检查地址";
  return `连接失败: ${msg}`;
}
```

### 3.4 重写 WorkspaceBar.tsx — 每个图标 = 一个服务器

```tsx
// packages/ui/src/workspace/WorkspaceBar.tsx（完全重写）
import { useState } from "react";
import { useSessionStore, switchSession } from "@magic/matrix-client";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { AddServerDialog } from "./AddServerDialog";

export function WorkspaceBar() {
  const sessions = useSessionStore((s) => s.getSessionList());
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1.5 bg-[#1E1F22] py-2 overflow-y-auto">
      {/* 每个图标 = 一个已登录的 Matrix 服务器 */}
      {sessions.map((session, index) => (
        <div key={session.id}>
          {index === 0 && sessions.length > 0 && null}
          <WorkspaceIcon
            initial={session.serverInitial}
            name={session.serverName}
            color={session.serverColor ?? undefined}
            isActive={session.id === activeSessionId}
            notificationCount={session.unreadCount}
            syncState={session.syncState}
            onClick={() => switchSession(session.id)}
          />
          {index === 0 && sessions.length > 1 && (
            <div className="mx-auto mt-1.5 mb-0.5 h-0.5 w-7 rounded-full bg-[#3F4147]" />
          )}
        </div>
      ))}

      {/* 分隔线（有会话时显示） */}
      {sessions.length > 0 && (
        <div className="mx-auto h-0.5 w-7 rounded-full bg-[#3F4147]" />
      )}

      {/* + 按钮 = 添加新的 Matrix 服务器 */}
      <button
        onClick={() => setShowAddDialog(true)}
        title="添加 Matrix 服务器"
        className="flex h-12 w-12 items-center justify-center rounded-full
                   border-[1.5px] border-dashed border-[#6D6F78] text-lg text-[#6D6F78]
                   transition-all duration-200
                   hover:rounded-xl hover:border-[#23A55A] hover:text-[#23A55A]"
      >
        +
      </button>

      {/* 添加服务器对话框 */}
      {showAddDialog && (
        <AddServerDialog onClose={() => setShowAddDialog(false)} />
      )}
    </div>
  );
}
```

### 3.5 更新 WorkspaceIcon.tsx — 同步状态指示

```tsx
// packages/ui/src/workspace/WorkspaceIcon.tsx（更新）
import { memo } from "react";

interface WorkspaceIconProps {
  initial: string;
  name: string;
  color?: string;
  isActive?: boolean;
  notificationCount?: number;
  syncState?: string;
  onClick: () => void;
}

export const WorkspaceIcon = memo(function WorkspaceIcon({
  initial, name, color, isActive = false, notificationCount, syncState, onClick,
}: WorkspaceIconProps) {
  const isSyncing = syncState === "SYNCING" || syncState === "RECONNECTING";
  const isError = syncState === "ERROR";

  return (
    <div className="relative flex items-center">
      {isActive && <div className="absolute -left-1 h-5 w-1 rounded-r-full bg-white" />}
      {!isActive && notificationCount != null && notificationCount > 0 && (
        <div className="absolute -left-1 h-2 w-1 rounded-r-full bg-white" />
      )}

      <button
        onClick={onClick}
        title={`${name}${isSyncing ? "（同步中）" : isError ? "（连接错误）" : ""}`}
        className={`flex h-12 w-12 items-center justify-center text-base font-semibold
                    transition-all duration-200
                    ${isActive
                      ? "rounded-xl text-white"
                      : "rounded-full bg-[#313338] text-[#DBDEE1] hover:rounded-xl hover:text-white"
                    }
                    ${isError ? "ring-2 ring-[#F23F43]" : ""}`}
        style={isActive
          ? { backgroundColor: color ?? "#5865F2" }
          : (!isActive && color ? { backgroundColor: color, color: "#fff" } : undefined)
        }
      >
        {isSyncing ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          initial
        )}
      </button>

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

### 3.6 WelcomePage.tsx — 首次打开的欢迎引导页

```tsx
// packages/ui/src/auth/WelcomePage.tsx
import { useState, type FormEvent } from "react";
import { addServer } from "@magic/matrix-client";

/**
 * 首次打开 MAGIC Client 时的欢迎页面。
 * 无任何已登录会话时显示。
 *
 * 布局：
 * ┌────┬───────────────────────────────┐
 * │ +  │                               │
 * │    │    MAGIC Logo + 标题           │
 * │    │                               │
 * │    │    ┌──────────────────────┐    │
 * │    │    │ 服务器地址            │    │
 * │    │    │ 用户名               │    │
 * │    │    │ 密码                 │    │
 * │    │    │ [连接服务器]          │    │
 * │    │    │                      │    │
 * │    │    │ ── 或快速连接 ──      │    │
 * │    │    │ HiClaw 本地开发  →   │    │
 * │    │    │ Matrix.org       →   │    │
 * │    │    └──────────────────────┘    │
 * │    │                               │
 * └────┴───────────────────────────────┘
 */

interface QuickServer {
  name: string;
  url: string;
  initial: string;
  color: string;
}

const QUICK_SERVERS: QuickServer[] = [
  { name: "HiClaw 本地开发", url: "https://matrix-local.hiclaw.io:18080", initial: "H", color: "#23A55A" },
  { name: "Matrix.org 公共服务器", url: "https://matrix.org", initial: "M", color: "#5865F2" },
];

export function WelcomePage() {
  const [homeserver, setHomeserver] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!homeserver.trim() || !username.trim() || !password.trim()) return;
    await doConnect(homeserver.trim(), username.trim(), password);
  };

  const handleQuickConnect = (server: QuickServer) => {
    setHomeserver(server.url);
    setError(null);
    // 填充 URL，用户还需要输入用户名密码
  };

  const doConnect = async (hs: string, user: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await addServer(hs, user, pass);
      // 成功后 sessionStore 有了会话，AuthGuard 自动切换到主界面
    } catch (err: any) {
      setError(parseConnectError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#313338]">
      {/* 左侧工作区栏 — 只有 + 按钮 */}
      <div className="flex w-14 shrink-0 flex-col items-center bg-[#1E1F22] pt-3">
        <button
          title="添加服务器"
          className="flex h-12 w-12 items-center justify-center rounded-full
                     border-[1.5px] border-dashed border-[#6D6F78] text-lg text-[#6D6F78]"
        >
          +
        </button>
        <span className="mt-3 text-[10px] text-[#6D6F78]"
              style={{ writingMode: "vertical-rl" }}>
          添加服务器
        </span>
      </div>

      {/* 主区域 — 居中欢迎卡片 */}
      <div className="flex flex-1 flex-col items-center justify-center">
        {/* Logo + 标题 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2] text-[28px] font-semibold text-white">
            M
          </div>
          <h1 className="text-[22px] font-semibold text-[#DBDEE1]">
            欢迎使用 MAGIC
          </h1>
          <p className="mt-1.5 text-[13px] text-[#949BA4]">
            Multi-Agent Governance & Intelligent Collaboration
          </p>
        </div>

        {/* 连接卡片 */}
        <div className="w-[380px] rounded-xl bg-[#2B2D31] px-8 py-7">
          <h2 className="text-[15px] font-semibold text-[#DBDEE1]">连接 Matrix 服务器</h2>
          <p className="mt-1 mb-5 text-xs text-[#949BA4] leading-relaxed">
            输入你的 Matrix homeserver 地址和账号信息，开始多 Agent 协同工作
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* 服务器地址 */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#949BA4]">服务器地址</label>
              <input
                type="url"
                value={homeserver}
                onChange={(e) => setHomeserver(e.target.value)}
                placeholder="https://matrix.magic.com"
                autoFocus
                disabled={isLoading}
                className="w-full rounded-md border border-[#3F4147] bg-[#1E1F22] px-3 py-2
                           text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                           focus:border-[#5865F2] focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* 用户名 */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#949BA4]">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@user:magic.com 或 user"
                disabled={isLoading}
                autoComplete="username"
                className="w-full rounded-md border border-[#3F4147] bg-[#1E1F22] px-3 py-2
                           text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                           focus:border-[#5865F2] focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#949BA4]">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                disabled={isLoading}
                autoComplete="current-password"
                className="w-full rounded-md border border-[#3F4147] bg-[#1E1F22] px-3 py-2
                           text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                           focus:border-[#5865F2] focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-[#F23F43]">
                {error}
              </div>
            )}

            {/* 连接按钮 */}
            <button
              type="submit"
              disabled={isLoading || !homeserver.trim() || !username.trim() || !password.trim()}
              className="w-full rounded-md bg-[#5865F2] py-2.5 text-sm font-medium text-white
                         hover:bg-[#4752C4] disabled:opacity-50 transition-colors"
            >
              {isLoading ? "连接中…" : "连接服务器"}
            </button>
          </form>

          {/* 快速连接 */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#3F4147]" />
            <span className="text-[11px] text-[#6D6F78]">或快速连接</span>
            <div className="h-px flex-1 bg-[#3F4147]" />
          </div>

          <div className="space-y-2">
            {QUICK_SERVERS.map((server) => (
              <button
                key={server.url}
                onClick={() => handleQuickConnect(server)}
                className="flex w-full items-center gap-3 rounded-lg border border-[#3F4147]
                           bg-[#313338] px-3 py-2.5 text-left transition-colors
                           hover:border-[#5865F2] hover:bg-[#35373C]"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: server.color }}
                >
                  {server.initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#DBDEE1]">{server.name}</p>
                  <p className="text-[11px] text-[#6D6F78]">{server.url}</p>
                </div>
                <span className="text-sm text-[#6D6F78]">→</span>
              </button>
            ))}
          </div>
        </div>

        {/* 底部版本号 */}
        <p className="mt-6 text-[11px] text-[#6D6F78]">
          MAGIC Client v0.0.1 · 基于 Matrix 协议
        </p>
      </div>
    </div>
  );
}

function parseConnectError(err: any): string {
  const msg = err?.message ?? String(err);
  if (msg.includes("M_FORBIDDEN")) return "用户名或密码错误";
  if (msg.includes("M_LIMIT_EXCEEDED")) return "登录请求过于频繁，请稍后重试";
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("ECONNREFUSED")) return "无法连接到服务器，请检查地址";
  return `连接失败: ${msg}`;
}
```

### 3.7 更新 AuthGuard.tsx — 无会话时显示 WelcomePage

```tsx
// packages/ui/src/auth/AuthGuard.tsx（更新逻辑）
// 当没有任何已登录的会话时，显示 WelcomePage 欢迎引导页。
// 有会话时，直接进入主界面。

import { useState, useEffect, type ReactNode } from "react";
import { useSessionStore, restoreAllSessions } from "@magic/matrix-client";
import { WelcomePage } from "./WelcomePage";

export function AuthGuard({ children }: { children: ReactNode }) {
  const sessions = useSessionStore((s) => s.sessions);
  const hasSessions = Object.keys(sessions).length > 0;
  const [initialized, setInitialized] = useState(false);

  // 应用启动时恢复所有已保存的会话
  useEffect(() => {
    restoreAllSessions().finally(() => setInitialized(true));
  }, []);

  // 恢复中 → 加载屏
  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1E1F22]">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2] text-[28px] font-semibold text-white">
            M
          </div>
          <div className="h-5 w-5 mx-auto animate-spin rounded-full border-2 border-[#5865F2] border-t-transparent" />
          <p className="mt-3 text-sm text-[#949BA4]">正在恢复会话…</p>
        </div>
      </div>
    );
  }

  // 无任何会话 → 欢迎引导页
  if (!hasSessions) {
    return <WelcomePage />;
  }

  // 有会话 → 主界面
  return <>{children}</>;
}
}
```

### 3.7 ServersSection.tsx — 服务器管理（设置页面）

```tsx
// packages/ui/src/settings/sections/ServersSection.tsx
import { useSessionStore, removeServer } from "@magic/matrix-client";
import { RoomAvatar } from "../../rooms/RoomAvatar";

export function ServersSection() {
  const sessions = useSessionStore((s) => s.getSessionList());
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  const handleRemove = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const confirmed = window.confirm(
      `确定要断开 ${session.serverName}（${session.homeserver}）吗？\n断开后需要重新登录才能恢复。`
    );
    if (confirmed) {
      await removeServer(sessionId);
    }
  };

  return (
    <div>
      <p className="mb-4 text-xs text-[#949BA4]">
        你已登录 {sessions.length} 个 Matrix 服务器。每个服务器在左侧栏显示为独立的工作区图标。
      </p>

      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`flex items-center gap-3 rounded-xl px-4 py-3
                       ${session.id === activeSessionId
                         ? "bg-[#5865F2]/10 border border-[#5865F2]/30"
                         : "bg-[#2B2D31]"}`}
          >
            {/* 服务器图标 */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: session.serverColor ?? "#5865F2" }}
            >
              {session.serverInitial}
            </div>

            {/* 信息 */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#DBDEE1]">{session.serverName}</p>
                {session.id === activeSessionId && (
                  <span className="rounded bg-[#5865F2]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#5865F2]">
                    当前
                  </span>
                )}
                <SyncBadge state={session.syncState} />
              </div>
              <p className="truncate text-xs text-[#6D6F78]">{session.userId}</p>
              <p className="truncate text-xs text-[#6D6F78]">{session.homeserver}</p>
            </div>

            {/* 断开按钮 */}
            <button
              onClick={() => handleRemove(session.id)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-[#F23F43]
                         hover:bg-[#F23F43]/10 transition-colors"
            >
              断开
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncBadge({ state }: { state: string }) {
  if (state === "PREPARED") return <span className="text-[10px] text-[#23A55A]">● 已连接</span>;
  if (state === "SYNCING") return <span className="text-[10px] text-[#F0B232]">● 同步中</span>;
  if (state === "ERROR") return <span className="text-[10px] text-[#F23F43]">● 连接错误</span>;
  if (state === "RECONNECTING") return <span className="text-[10px] text-[#F0B232]">● 重连中</span>;
  return <span className="text-[10px] text-[#6D6F78]">● 已断开</span>;
}
```

### 3.8 SettingsPage.tsx — 设置页面（含服务器管理标签）

```tsx
// packages/ui/src/settings/SettingsPage.tsx
import { useState, useEffect } from "react";
import { SettingsNav, type SettingsTab } from "./SettingsNav";
import { SettingsSection } from "./SettingsSection";
import { AccountSection } from "./sections/AccountSection";
import { ServersSection } from "./sections/ServersSection";
import { AppearanceSection } from "./sections/AppearanceSection";
import { NotificationSettings } from "../notifications/NotificationSettings";
import { LanguageSection } from "./sections/LanguageSection";
import { SecuritySection } from "./sections/SecuritySection";

interface SettingsPageProps {
  onClose: () => void;
}

const TAB_TITLES: Record<SettingsTab, string> = {
  account: "账户",
  servers: "服务器管理",
  appearance: "外观",
  notifications: "通知",
  language: "语言",
  security: "设备管理",
};

export function SettingsPage({ onClose }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex bg-[#313338]">
      <div className="flex justify-end bg-[#2B2D31]" style={{ flex: "1 0 218px" }}>
        <SettingsNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <div className="flex" style={{ flex: "1 1 800px", maxWidth: "740px" }}>
        <SettingsSection title={TAB_TITLES[activeTab]}>
          {activeTab === "account" && <AccountSection />}
          {activeTab === "servers" && <ServersSection />}
          {activeTab === "appearance" && <AppearanceSection />}
          {activeTab === "notifications" && <NotificationSettings />}
          {activeTab === "language" && <LanguageSection />}
          {activeTab === "security" && <SecuritySection />}
        </SettingsSection>

        <div className="flex shrink-0 items-start pt-6 pr-4">
          <button onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-full
                             border border-[#6D6F78] text-[#949BA4]
                             hover:border-[#DBDEE1] hover:text-[#DBDEE1] transition-colors"
                  title="关闭设置 (ESC)">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="ml-2 mt-2.5 text-[10px] text-[#6D6F78]">ESC</span>
        </div>
      </div>
      <div style={{ flex: "1 0 0" }} />
    </div>
  );
}
```

### 3.9 SettingsNav.tsx — 导航（含服务器标签）

```tsx
// packages/ui/src/settings/SettingsNav.tsx

export type SettingsTab = "account" | "servers" | "appearance" | "notifications" | "language" | "security";

const NAV_GROUPS = [
  {
    label: "用户设置",
    items: [
      { key: "account" as const, label: "账户" },
      { key: "servers" as const, label: "服务器管理" },
      { key: "appearance" as const, label: "外观" },
      { key: "notifications" as const, label: "通知" },
    ],
  },
  {
    label: "应用设置",
    items: [
      { key: "language" as const, label: "语言" },
    ],
  },
  {
    label: "安全",
    items: [
      { key: "security" as const, label: "设备管理" },
    ],
  },
];

// ... 其余组件代码与之前相同，追加服务器标签即可
```

### 3.10 更新 002 的 client.ts — getClient 适配多会话

```typescript
// packages/matrix-client/src/client.ts（追加）

import { getSessionClient } from "./session-manager";

/**
 * 获取当前活跃会话的 MatrixClient。
 * 兼容旧的单例调用方式——现在从 session-manager 获取。
 */
export function getClient(): MatrixClient {
  const client = getSessionClient();
  if (!client) {
    throw new MagicClientError("无活跃的 MatrixClient 会话");
  }
  return client;
}
```

---

## 4. 更新导出

**matrix-client/src/index.ts** 追加：
```typescript
export { useSessionStore } from "./stores/sessionStore";
export type { ServerSession } from "./stores/sessionStore";
export { addServer, removeServer, switchSession, restoreAllSessions, getSessionClient, createSessionId } from "./session-manager";
```

**ui/src/index.ts** 追加：
```typescript
export { SettingsPage } from "./settings/SettingsPage";
export { AddServerDialog } from "./workspace/AddServerDialog";
export { WelcomePage } from "./auth/WelcomePage";
export { ServersSection } from "./settings/sections/ServersSection";
export { useSettings } from "./hooks/useSettings";
```

---

## 5. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 首次启动无会话时显示 WelcomePage 欢迎引导页（MAGIC Logo + 服务器连接表单 + 快速连接列表） | 清除 localStorage 后启动 |
| AC-2 | WelcomePage 左侧有空的工作区栏（仅显示 + 按钮和"添加服务器"竖排文字） | 视觉检查 |
| AC-3 | WelcomePage 快速连接列表点击后自动填充服务器地址到表单 | 手动验证 |
| AC-4 | WelcomePage 连接成功后自动进入主界面，左侧栏出现第一个服务器图标 | 手动验证 |
| AC-5 | 登录后工作区栏出现该服务器的图标 | 视觉检查 |
| AC-6 | 点击 `+` 弹出添加服务器对话框，输入新服务器信息后登录 | 手动验证 |
| AC-7 | 登录第二个服务器后工作区栏出现第二个图标 | 手动验证 |
| AC-8 | 点击不同图标切换工作区，房间列表/聊天区切换到对应服务器 | 手动验证 |
| AC-9 | 每个服务器独立显示未读角标 | 视觉检查 |
| AC-10 | 关闭重开应用，所有已登录服务器自动恢复 | 重启后检查 |
| AC-11 | 设置页面 → 服务器管理 显示所有已登录的服务器 | 视觉检查 |
| AC-12 | 点击"断开"可以登出某个服务器，不影响其他服务器 | 手动验证 |
| AC-13 | 齿轮按钮打开全屏设置，ESC 关闭 | 手动验证 |
| AC-14 | 设置页面各标签（账户/服务器/外观/通知/语言/安全）功能正常 | 逐个验证 |
| AC-15 | 同步中的服务器图标显示 spinner | 视觉检查 |
| AC-16 | 连接错误的服务器图标显示红色边框 | 断开网络后检查 |
| AC-17 | `pnpm typecheck && pnpm build` 通过 | 命令验证 |

---

## 6. 实现任务（按执行顺序）

### 任务 1：创建 sessionStore

**创建文件**：`packages/matrix-client/src/stores/sessionStore.ts`

**验证**：`pnpm typecheck`

---

### 任务 2：创建 session-manager

**创建文件**：`packages/matrix-client/src/session-manager.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：更新 client.ts — getClient 适配多会话

**修改文件**：`packages/matrix-client/src/client.ts`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 AddServerDialog

**创建文件**：`packages/ui/src/workspace/AddServerDialog.tsx`

**验证**：`pnpm typecheck`

---

### 任务 5：重写 WorkspaceBar + 更新 WorkspaceIcon

**修改文件**：
- `packages/ui/src/workspace/WorkspaceBar.tsx`（完全重写）
- `packages/ui/src/workspace/WorkspaceIcon.tsx`（追加 syncState prop）

**验证**：`pnpm typecheck`

---

### 任务 6：创建 WelcomePage + 更新 AuthGuard

**创建文件**：`packages/ui/src/auth/WelcomePage.tsx`（第 3.6 节完整代码）

**修改文件**：`packages/ui/src/auth/AuthGuard.tsx`（第 3.7 节完整代码）

**关键**：
- WelcomePage 包含完整的登录表单 + 快速连接预置列表
- 左侧显示空的工作区栏（仅 + 按钮 + "添加服务器"竖排文字）
- 连接成功后 sessionStore 有了会话 → AuthGuard 自动切换到主界面
- AuthGuard 启动时调用 `restoreAllSessions()`，恢复中显示 MAGIC Logo + spinner

**验证**：`pnpm typecheck`

---

### 任务 7：创建设置页面通用组件 + 分区页面

**创建文件**：
- `packages/ui/src/settings/components/SettingsToggle.tsx`
- `packages/ui/src/settings/components/SettingsRadioGroup.tsx`
- `packages/ui/src/settings/components/SettingsInput.tsx`
- `packages/ui/src/settings/sections/AccountSection.tsx`
- `packages/ui/src/settings/sections/ServersSection.tsx`
- `packages/ui/src/settings/sections/AppearanceSection.tsx`
- `packages/ui/src/settings/sections/LanguageSection.tsx`
- `packages/ui/src/settings/sections/SecuritySection.tsx`
- `packages/ui/src/settings/SettingsNav.tsx`
- `packages/ui/src/settings/SettingsSection.tsx`
- `packages/ui/src/settings/SettingsPage.tsx`
- `packages/ui/src/hooks/useSettings.ts`

**验证**：`pnpm typecheck`

---

### 任务 8：更新 UserPanel + MainLayout

**修改文件**：
- `packages/ui/src/workspace/UserPanel.tsx`（追加齿轮按钮）
- `packages/ui/src/layouts/MainLayout.tsx`（接入 SettingsPage）

**验证**：`pnpm dev:desktop`

---

### 任务 9：更新导出

**修改文件**：
- `packages/matrix-client/src/index.ts`
- `packages/ui/src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 10：编写单元测试

**创建文件**：
- `packages/matrix-client/__tests__/stores/sessionStore.test.ts` — 增删切换会话
- `packages/matrix-client/__tests__/session-manager.test.ts` — addServer、switchSession、removeServer
- `packages/ui/__tests__/workspace/AddServerDialog.test.tsx`
- `packages/ui/__tests__/auth/WelcomePage.test.tsx` — 表单提交、快速连接填充、错误显示

**验证**：`pnpm test`

---

### 任务 11：全局集成验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 首次启动 → WelcomePage → 连接服务器 → 进入主界面 → + 添加第二个 → 切换 → 设置 → 断开一个
pnpm dev:web       # 同上
```

完成后提交：
```bash
git add -A
git commit -m "feat: 016 - multi-server workspaces, settings page, session manager"
```

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 多个 MatrixClient 同时 sync 占用大量内存 | 性能差 | 每个客户端 `initialSyncLimit: 20` + `lazyLoadMembers: true`；后续可实现"非活跃会话降低 sync 频率" |
| 切换会话时 roomStore 数据混乱 | 显示错误房间 | `switchSession` 中先快照当前 rooms、再恢复目标 rooms |
| accessToken 存储在 localStorage | 安全风险 | Electron 端后续迁移到 electron-store（加密存储）；Web 端使用 HttpOnly cookie（需服务端配合） |
| `initRustCrypto()` 每个会话都要调用 | 启动慢 | 恢复会话时串行初始化，显示进度（"恢复 1/3 服务器…"） |
| bridge.ts 的回调是全局的，多会话会冲突 | 事件混乱 | 每个会话独立调用 `bridgeToStores()`，桥接函数内部根据 room.roomId 匹配会话 |