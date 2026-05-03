# Spec 017: 多会话架构修复（Multi-Session Architecture Fix）

> 优先级: P0（阻塞性 Bug） | 波次: Wave 5 | 预估: 2-3 天 | 前置依赖: 016-settings-page
> 文件路径: `specs/017-multi-session-fix/spec.md`

---

## 1. 目标

修复 016 spec 引入的 5 个架构缺陷，确保多服务器同时登录在真实场景下正确运行。

### 缺陷清单

| # | 严重度 | 问题 | 根因 |
|---|--------|------|------|
| BUG-1 | 🔴 严重 | A 服务器的消息出现在 B 服务器的房间列表中 | `useRoomStore` 是全局单例，所有会话的 bridge.ts 往同一个 store 写入 |
| BUG-2 | 🔴 严重 | 切换会话后收到旧会话的消息仍更新到当前视图 | `bridge.ts` 的事件监听是全局的，没有按 sessionId 隔离 |
| BUG-3 | 🟡 中等 | accessToken 明文存在 localStorage | Electron 端应使用 electron-store（加密存储） |
| BUG-4 | 🟡 中等 | 恢复多个会话时无进度提示 | 串行恢复 3+ 个服务器可能需要 10+ 秒，用户看到的只是空白 spinner |
| BUG-5 | 🟡 中等 | 5 个服务器同时全速 sync 占用大量内存和带宽 | 非活跃会话没有降低 sync 频率 |

---

## 2. 修复方案

### 2.1 BUG-1 + BUG-2：Per-Session Store 隔离

**根因分析**：

016 中所有会话共享同一个全局 `useRoomStore`、`useSyncStore`、`useTypingStore` 等。`switchSession` 通过快照/恢复 rooms 数据来切换，但 bridge.ts 的事件回调是全局挂载的——A 会话的 `onTimeline` 回调会调用 `useRoomStore.getState().addMessage()`，直接写入当前 UI 正在展示的 B 会话数据中。

**修复方案：每个会话持有独立的 store 数据容器**

不创建多个 Zustand store 实例（会导致 React hooks 无法动态切换），而是在**单个全局 store 中按 sessionId 分区存储**：

```typescript
// 之前（016）：
useRoomStore = { rooms: { "!abc:server1": {...}, "!def:server2": {...} } }
// 所有会话的 rooms 混在一起

// 之后（017）：
useRoomStore = {
  sessionRooms: {
    "session_abc": { "!abc:server1": {...} },
    "session_def": { "!def:server2": {...} },
  },
  activeSessionId: "session_abc",
  // getter: rooms 返回当前活跃 session 的数据
  get rooms() { return sessionRooms[activeSessionId] }
}
```

**bridge.ts 修复**：每个 `bridgeToStores(client, sessionId)` 调用时绑定 sessionId，回调内部写入对应 session 的分区，不影响其他 session。

### 2.2 BUG-3：安全 Token 存储

| 环境 | 当前 | 修复后 |
|------|------|--------|
| Electron | localStorage（明文） | electron-store（自动加密，存储在 `app.getPath("userData")`）|
| Web | localStorage（明文） | 仍用 localStorage，但 token 用 AES-GCM 加密（密钥派生自 deviceId）|

### 2.3 BUG-4：恢复进度提示

在 AuthGuard 的恢复阶段显示"正在恢复会话 (1/3)…"进度文字。

### 2.4 BUG-5：非活跃会话降频

活跃会话正常 sync（实时），非活跃会话切换为**30 秒轮询模式**（只更新未读计数，不拉取完整 timeline）。用户切换到某个会话时恢复为实时 sync。

---

## 3. 技术规格

### 3.1 重构 roomStore.ts — Per-Session 分区存储

```typescript
// packages/matrix-client/src/stores/roomStore.ts（重构）
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { SerializedMatrixEvent } from "@magic/shared-types";

export interface RoomData {
  roomId: string;
  name: string;
  topic: string;
  avatarMxc: string | null;
  memberCount: number;
  unreadCount: number;
  highlightCount: number;
  timeline: SerializedMatrixEvent[];
  lastMessage: SerializedMatrixEvent | null;
  isEncrypted: boolean;
  isDirect: boolean;
  lastActivityTs: number;
}

interface RoomStoreState {
  /** sessionId → { roomId → RoomData } */
  sessionRooms: Record<string, Record<string, RoomData>>;
  /** 当前活跃的 sessionId */
  activeSessionId: string | null;
  /** 当前活跃房间 ID */
  activeRoomId: string | null;

  // ---- 派生 getter ----

  /** 获取当前活跃 session 的 rooms（UI 层直接使用） */
  readonly rooms: Record<string, RoomData>;

  // ---- Session 管理 ----

  setActiveSession: (sessionId: string | null) => void;
  initSession: (sessionId: string) => void;
  removeSession: (sessionId: string) => void;

  // ---- 房间操作（需要 sessionId） ----

  setActiveRoom: (roomId: string | null) => void;
  upsertRoom: (sessionId: string, roomId: string, data: Partial<RoomData>) => void;
  removeRoom: (sessionId: string, roomId: string) => void;
  addMessage: (sessionId: string, roomId: string, event: SerializedMatrixEvent) => void;
  prependMessages: (sessionId: string, roomId: string, events: SerializedMatrixEvent[]) => void;
  setUnreadCount: (sessionId: string, roomId: string, count: number, highlight: number) => void;

  reset: () => void;
}

function createDefaultRoom(roomId: string): RoomData {
  return {
    roomId, name: "", topic: "", avatarMxc: null, memberCount: 0,
    unreadCount: 0, highlightCount: 0, timeline: [], lastMessage: null,
    isEncrypted: false, isDirect: false, lastActivityTs: 0,
  };
}

export const useRoomStore = create<RoomStoreState>()(
  immer((set, get) => ({
    sessionRooms: {},
    activeSessionId: null,
    activeRoomId: null,

    // 派生：当前 session 的 rooms
    get rooms() {
      const { sessionRooms, activeSessionId } = get();
      return activeSessionId ? sessionRooms[activeSessionId] ?? {} : {};
    },

    setActiveSession: (sessionId) => set((s) => {
      s.activeSessionId = sessionId;
      s.activeRoomId = null; // 切换 session 时清空活跃房间
    }),

    initSession: (sessionId) => set((s) => {
      if (!s.sessionRooms[sessionId]) {
        s.sessionRooms[sessionId] = {};
      }
    }),

    removeSession: (sessionId) => set((s) => {
      delete s.sessionRooms[sessionId];
      if (s.activeSessionId === sessionId) {
        s.activeSessionId = Object.keys(s.sessionRooms)[0] ?? null;
        s.activeRoomId = null;
      }
    }),

    setActiveRoom: (roomId) => set((s) => {
      s.activeRoomId = roomId;
    }),

    // ⭐ 关键：所有写操作都需要 sessionId，只写入对应分区
    upsertRoom: (sessionId, roomId, data) => set((s) => {
      if (!s.sessionRooms[sessionId]) s.sessionRooms[sessionId] = {};
      if (!s.sessionRooms[sessionId][roomId]) {
        s.sessionRooms[sessionId][roomId] = createDefaultRoom(roomId);
      }
      Object.assign(s.sessionRooms[sessionId][roomId], data);
    }),

    removeRoom: (sessionId, roomId) => set((s) => {
      if (s.sessionRooms[sessionId]) {
        delete s.sessionRooms[sessionId][roomId];
      }
      if (s.activeSessionId === sessionId && s.activeRoomId === roomId) {
        s.activeRoomId = null;
      }
    }),

    addMessage: (sessionId, roomId, event) => set((s) => {
      const rooms = s.sessionRooms[sessionId];
      if (!rooms) return;
      if (!rooms[roomId]) rooms[roomId] = createDefaultRoom(roomId);
      const room = rooms[roomId];
      if (!room.timeline.some((e) => e.eventId === event.eventId)) {
        room.timeline.push(event);
        room.lastMessage = event;
        room.lastActivityTs = event.timestamp;
      }
    }),

    prependMessages: (sessionId, roomId, events) => set((s) => {
      const rooms = s.sessionRooms[sessionId];
      if (!rooms?.[roomId]) return;
      const existing = new Set(rooms[roomId].timeline.map((e) => e.eventId));
      const newEvents = events.filter((e) => !existing.has(e.eventId));
      rooms[roomId].timeline.unshift(...newEvents);
    }),

    setUnreadCount: (sessionId, roomId, count, highlight) => set((s) => {
      const rooms = s.sessionRooms[sessionId];
      if (rooms?.[roomId]) {
        rooms[roomId].unreadCount = count;
        rooms[roomId].highlightCount = highlight;
      }
    }),

    reset: () => set({ sessionRooms: {}, activeSessionId: null, activeRoomId: null }),
  }))
);
```

### 3.2 重构 typingStore.ts — Per-Session 分区

```typescript
// packages/matrix-client/src/stores/typingStore.ts（重构）
import { create } from "zustand";

interface TypingStoreState {
  /** sessionId → { roomId → userId[] } */
  sessionTyping: Record<string, Record<string, string[]>>;

  setTyping: (sessionId: string, roomId: string, userId: string, isTyping: boolean) => void;
  getTyping: (sessionId: string, roomId: string) => string[];
  reset: () => void;
}

export const useTypingStore = create<TypingStoreState>((set, get) => ({
  sessionTyping: {},

  setTyping: (sessionId, roomId, userId, isTyping) => set((s) => {
    if (!s.sessionTyping[sessionId]) s.sessionTyping[sessionId] = {};
    const current = new Set(s.sessionTyping[sessionId][roomId] ?? []);
    if (isTyping) current.add(userId); else current.delete(userId);
    return {
      sessionTyping: {
        ...s.sessionTyping,
        [sessionId]: {
          ...s.sessionTyping[sessionId],
          [roomId]: Array.from(current),
        },
      },
    };
  }),

  getTyping: (sessionId, roomId) => {
    return get().sessionTyping[sessionId]?.[roomId] ?? [];
  },

  reset: () => set({ sessionTyping: {} }),
}));
```

### 3.3 重构 bridge.ts — 绑定 sessionId

```typescript
// packages/matrix-client/src/bridge.ts（关键变更）

/**
 * 将 MatrixClient 的事件桥接到 Zustand stores。
 * ⭐ 每次调用时绑定 sessionId，所有写操作都写入对应分区。
 */
export function bridgeToStores(
  client: MatrixClient,
  sessionId: string,          // ← 新增参数
): () => void {

  // ---- 同步状态 ----
  const onSync = (state: string, _prevState: string | null, data?: { error?: Error }) => {
    // 只更新对应 session 的 syncState
    useSessionStore.getState().updateSession(sessionId, {
      syncState: mapSyncState(state),
    });

    if (state === "PREPARED") {
      syncRoomList(client, sessionId);  // ← 传入 sessionId
    }
  };
  client.on(ClientEvent.Sync, onSync);

  // ---- 新消息 ----
  const onTimeline = (event: any, room: Room | undefined, toStartOfTimeline: boolean | undefined) => {
    if (!room || toStartOfTimeline) return;
    const serialized = serializeEvent(event);
    // ⭐ 写入指定 session 的分区，不影响其他 session
    useRoomStore.getState().addMessage(sessionId, room.roomId, serialized);

    // 通知回调
    notificationCallback?.(serialized);
  };
  client.on(RoomEvent.Timeline, onTimeline);

  // ---- 房间名称变化 ----
  const onRoomName = (room: Room) => {
    useRoomStore.getState().upsertRoom(sessionId, room.roomId, { name: room.name });
  };
  client.on(RoomEvent.Name, onRoomName);

  // ---- 未读数变化 ----
  const onUnreadCount = (room: Room) => {
    useRoomStore.getState().setUnreadCount(
      sessionId,
      room.roomId,
      room.getUnreadNotificationCount("total") ?? 0,
      room.getUnreadNotificationCount("highlight") ?? 0,
    );

    // 更新 session 的总未读数
    updateSessionUnreadCount(sessionId);
  };
  client.on(RoomEvent.UnreadNotifications, onUnreadCount);

  // ---- 输入提示 ----
  const onTyping = (_event: any, member: any) => {
    useTypingStore.getState().setTyping(sessionId, member.roomId, member.userId, member.typing);
  };
  client.on(RoomMemberEvent.Typing, onTyping);

  // ---- 成员变化 ----
  const onMembership = (room: Room, membership: string) => {
    if (membership === "leave") {
      useRoomStore.getState().removeRoom(sessionId, room.roomId);
    }
  };
  client.on(RoomEvent.MyMembership, onMembership);

  // ---- Cleanup ----
  return () => {
    client.off(ClientEvent.Sync, onSync);
    client.off(RoomEvent.Timeline, onTimeline);
    client.off(RoomEvent.Name, onRoomName);
    client.off(RoomEvent.UnreadNotifications, onUnreadCount);
    client.off(RoomMemberEvent.Typing, onTyping);
    client.off(RoomEvent.MyMembership, onMembership);
  };
}

/**
 * 同步房间列表——写入指定 session 的分区。
 */
function syncRoomList(client: MatrixClient, sessionId: string): void {
  const rooms = client.getRooms();
  const roomStore = useRoomStore.getState();

  // ⭐ 确保 session 分区已初始化
  roomStore.initSession(sessionId);

  for (const room of rooms) {
    roomStore.upsertRoom(sessionId, room.roomId, {
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

/**
 * 更新 session 的总未读/提及数（用于工作区栏角标）。
 */
function updateSessionUnreadCount(sessionId: string): void {
  const rooms = useRoomStore.getState().sessionRooms[sessionId] ?? {};
  let totalUnread = 0;
  let totalHighlight = 0;
  for (const room of Object.values(rooms)) {
    totalUnread += room.unreadCount;
    totalHighlight += room.highlightCount;
  }
  useSessionStore.getState().updateSession(sessionId, {
    unreadCount: totalUnread,
    highlightCount: totalHighlight,
  });
}
```

### 3.4 更新 session-manager.ts — 传递 sessionId 到 bridge

```typescript
// packages/matrix-client/src/session-manager.ts（关键变更）

async function startSessionSync(sessionId: string): Promise<void> {
  const client = clients.get(sessionId);
  if (!client) return;

  // ⭐ 初始化 session 的 store 分区
  useRoomStore.getState().initSession(sessionId);

  // ⭐ 传入 sessionId，桥接事件只写入对应分区
  const cleanup = bridgeToStores(client, sessionId);
  cleanups.set(sessionId, cleanup);

  await client.startClient({ initialSyncLimit: 20, lazyLoadMembers: true });
}

/**
 * 切换活跃会话。
 * ⭐ 不再需要快照/恢复 rooms——每个 session 的数据已经在各自分区中。
 */
export function switchSession(targetSessionId: string): void {
  const store = useSessionStore.getState();
  if (store.activeSessionId === targetSessionId) return;

  // 切换 session
  store.setActiveSession(targetSessionId);

  // 切换 roomStore 的活跃 session（UI 自动读取对应分区的 rooms）
  useRoomStore.getState().setActiveSession(targetSessionId);

  // 非活跃会话降频，活跃会话恢复全速
  throttleInactiveSessions(targetSessionId);
}

// 删除旧的 roomSnapshots Map——不再需要
```

### 3.5 安全 Token 存储

```typescript
// packages/matrix-client/src/session-manager.ts（更新持久化部分）

const SESSION_STORAGE_KEY = "magic_sessions";
const ENCRYPTION_KEY_NAME = "magic_session_key";

// ---- Electron 端：通过 IPC 使用 electron-store ----

async function persistSessions(): Promise<void> {
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

  if (isElectronEnv()) {
    // Electron：通过 IPC 存储到 electron-store（自动加密）
    try {
      const electronAPI = (window as any).electronAPI;
      await electronAPI.setSetting("sessions", sessions);
    } catch {}
  } else {
    // Web：加密后存入 localStorage
    try {
      const encrypted = await encryptData(JSON.stringify(sessions));
      localStorage.setItem(SESSION_STORAGE_KEY, encrypted);
    } catch {
      // 降级：明文存储（开发环境）
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
    }
  }
}

async function loadPersistedSessions(): Promise<any[]> {
  if (isElectronEnv()) {
    try {
      const electronAPI = (window as any).electronAPI;
      const stored = await electronAPI.getSettings();
      return stored?.sessions ?? [];
    } catch { return []; }
  }

  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return [];
    // 尝试解密
    try {
      const decrypted = await decryptData(raw);
      return JSON.parse(decrypted);
    } catch {
      // 兼容旧格式（明文）
      return JSON.parse(raw);
    }
  } catch { return []; }
}

function isElectronEnv(): boolean {
  return typeof window !== "undefined" && "electronAPI" in window;
}

// ---- Web 端 AES-GCM 加密 ----

async function getEncryptionKey(): Promise<CryptoKey> {
  // 从 IndexedDB 获取或生成密钥
  const db = await openDB();
  const existing = await db.get("keys", ENCRYPTION_KEY_NAME);
  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // 不可导出
    ["encrypt", "decrypt"],
  );
  await db.put("keys", key, ENCRYPTION_KEY_NAME);
  return key;
}

async function encryptData(data: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  // 拼接 iv + ciphertext，Base64 编码
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encrypted: string): Promise<string> {
  const key = await getEncryptionKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

async function openDB(): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("magic_keystore", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("keys");
    };
    request.onsuccess = () => resolve({
      get: (store: string, key: string) => new Promise((res) => {
        const tx = request.result.transaction(store, "readonly");
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => res(req.result);
      }),
      put: (store: string, value: any, key: string) => new Promise<void>((res) => {
        const tx = request.result.transaction(store, "readwrite");
        tx.objectStore(store).put(value, key);
        tx.oncomplete = () => res();
      }),
    });
    request.onerror = () => reject(request.error);
  });
}
```

### 3.6 恢复进度提示

```typescript
// packages/matrix-client/src/session-manager.ts（更新 restoreAllSessions）

export interface RestoreProgress {
  current: number;
  total: number;
  serverName: string;
}

let progressCallback: ((progress: RestoreProgress) => void) | null = null;

export function onRestoreProgress(cb: (progress: RestoreProgress) => void): void {
  progressCallback = cb;
}

export async function restoreAllSessions(): Promise<void> {
  const saved = await loadPersistedSessions();
  if (saved.length === 0) return;

  for (let i = 0; i < saved.length; i++) {
    const session = saved[i];

    // ⭐ 报告进度
    progressCallback?.({
      current: i + 1,
      total: saved.length,
      serverName: session.serverName ?? session.homeserver,
    });

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
      useSessionStore.getState().addSession({
        ...session,
        displayName: null,
        avatarMxc: null,
        syncState: "STOPPED",
        unreadCount: 0,
        highlightCount: 0,
      });
      await startSessionSync(session.id);
    } catch (err) {
      console.error(`恢复会话 ${session.serverName} 失败:`, err);
    }
  }
}
```

```tsx
// packages/ui/src/auth/AuthGuard.tsx（更新恢复进度 UI）

import { restoreAllSessions, onRestoreProgress, type RestoreProgress } from "@magic/matrix-client";

export function AuthGuard({ children }: { children: ReactNode }) {
  const sessions = useSessionStore((s) => s.sessions);
  const hasSessions = Object.keys(sessions).length > 0;
  const [initialized, setInitialized] = useState(false);
  const [progress, setProgress] = useState<RestoreProgress | null>(null);

  useEffect(() => {
    onRestoreProgress(setProgress);
    restoreAllSessions().finally(() => setInitialized(true));
  }, []);

  if (!initialized) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#1E1F22]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2] text-[28px] font-semibold text-white">
          M
        </div>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5865F2] border-t-transparent" />
        {/* ⭐ 进度提示 */}
        {progress ? (
          <p className="mt-4 text-sm text-[#949BA4]">
            正在恢复会话 ({progress.current}/{progress.total})
          </p>
          <p className="mt-1 text-xs text-[#6D6F78]">
            {progress.serverName}
          </p>
        ) : (
          <p className="mt-4 text-sm text-[#949BA4]">正在恢复会话…</p>
        )}
      </div>
    );
  }

  if (!hasSessions) return <WelcomePage />;
  return <>{children}</>;
}
```

### 3.7 非活跃会话降频

```typescript
// packages/matrix-client/src/session-manager.ts（新增）

/** 每个非活跃会话的降频 sync 间隔 */
const INACTIVE_SYNC_INTERVAL = 30_000; // 30 秒

const inactivePollers = new Map<string, ReturnType<typeof setInterval>>();

/**
 * 将非活跃会话从实时 sync 切换为低频轮询。
 * 活跃会话恢复实时 sync。
 */
function throttleInactiveSessions(activeSessionId: string): void {
  for (const [sessionId, client] of clients.entries()) {
    if (sessionId === activeSessionId) {
      // ⭐ 活跃会话：停止低频轮询，恢复实时 sync
      const poller = inactivePollers.get(sessionId);
      if (poller) {
        clearInterval(poller);
        inactivePollers.delete(sessionId);
      }
      // 确保 sync 在运行
      if (!client.clientRunning) {
        client.startClient({ initialSyncLimit: 20, lazyLoadMembers: true });
      }
    } else {
      // ⭐ 非活跃会话：停止实时 sync，启动低频轮询
      if (!inactivePollers.has(sessionId)) {
        // 不停止 sync（保持连接以接收通知），但降低 sync 的处理优先级
        // 实际方案：设置更长的 sync timeout
        try {
          client.retryImmediately();
        } catch {}

        // 定期更新未读计数（即使不处理完整 timeline）
        const poller = setInterval(() => {
          updateSessionUnreadCount(sessionId);
        }, INACTIVE_SYNC_INTERVAL);
        inactivePollers.set(sessionId, poller);
      }
    }
  }
}

/**
 * 清理所有降频轮询（应用退出时调用）。
 */
export function cleanupAllPollers(): void {
  for (const poller of inactivePollers.values()) {
    clearInterval(poller);
  }
  inactivePollers.clear();
}
```

### 3.8 更新 Electron IPC — sessions 存储

```typescript
// apps/desktop/src/main/store.ts（更新）
// 在 electron-store 的 defaults 中追加 sessions 字段：

const defaults = {
  // ... 已有设置 ...
  sessions: [],  // 会话列表（electron-store 自动加密存储）
};
```

### 3.9 更新 UI 层 — 适配分区 store

所有使用 `useRoomStore((s) => s.rooms)` 的组件**不需要修改**——因为重构后的 store 通过 getter 自动返回当前活跃 session 的 rooms。

但以下地方需要适配：

```typescript
// useTimeline.ts — 获取 typing 时需要 sessionId
const activeSessionId = useSessionStore((s) => s.activeSessionId);
const typingUsers = useTypingStore((s) =>
  activeSessionId ? s.getTyping(activeSessionId, roomId) : []
);

// useFilteredRooms.ts — rooms 已通过 getter 自动过滤，无需改动

// NotificationService.ts — evaluateNotification 中 activeRoomId 判断无需改动
// （roomStore.activeRoomId 已与 activeSessionId 联动）
```

---

## 4. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | 登录两个服务器后，A 服务器的消息不出现在 B 服务器的房间列表中 | 同时在两个服务器发消息 |
| AC-2 | 切换工作区后，只显示对应服务器的房间和消息 | 快速切换验证 |
| AC-3 | 在 B 工作区时，A 服务器收到新消息，A 的工作区图标未读角标更新但 B 的聊天区不受影响 | 后台接收消息 |
| AC-4 | Electron 端 accessToken 不在 localStorage 中（存储在 electron-store） | DevTools → Application → LocalStorage 检查 |
| AC-5 | Web 端 localStorage 中的会话数据为加密字符串（非明文 JSON） | DevTools → Application → LocalStorage 检查 |
| AC-6 | 恢复 3 个会话时显示 "正在恢复会话 (1/3)" → "(2/3)" → "(3/3)" 进度 | 清缓存 → 重启 |
| AC-7 | 进度提示下方显示当前正在恢复的服务器名称 | 视觉检查 |
| AC-8 | 非活跃工作区的消息通知仍能触发（sync 未完全停止） | 切到 B，从另一端给 A 发 @提及 |
| AC-9 | 切换到非活跃工作区后该工作区立即变为实时 sync | 切换后发消息验证延迟 |
| AC-10 | `pnpm typecheck && pnpm build` 通过 | 命令验证 |

---

## 5. 实现任务（按执行顺序）

### 任务 1：重构 roomStore — per-session 分区

**修改文件**：`packages/matrix-client/src/stores/roomStore.ts`（完全重写为 3.1 节代码）

**验证**：`pnpm typecheck`

---

### 任务 2：重构 typingStore — per-session 分区

**修改文件**：`packages/matrix-client/src/stores/typingStore.ts`（重写为 3.2 节代码）

**验证**：`pnpm typecheck`

---

### 任务 3：重构 bridge.ts — 绑定 sessionId

**修改文件**：`packages/matrix-client/src/bridge.ts`（3.3 节，所有写操作传入 sessionId）

**验证**：`pnpm typecheck`

---

### 任务 4：更新 session-manager.ts — 删除快照机制 + 传入 sessionId

**修改文件**：`packages/matrix-client/src/session-manager.ts`

**变更**：
- `startSessionSync` 调用 `bridgeToStores(client, sessionId)`
- `switchSession` 改为调用 `roomStore.setActiveSession(targetSessionId)` + `throttleInactiveSessions()`
- 删除 `roomSnapshots` Map 和快照/恢复逻辑

**验证**：`pnpm typecheck`

---

### 任务 5：实现安全 Token 存储

**修改文件**：`packages/matrix-client/src/session-manager.ts`（3.5 节，加密持久化）

**修改文件**：`apps/desktop/src/main/store.ts`（追加 sessions 字段）

**验证**：`pnpm typecheck`

---

### 任务 6：实现恢复进度提示

**修改文件**：
- `packages/matrix-client/src/session-manager.ts`（3.6 节，`onRestoreProgress` 回调）
- `packages/ui/src/auth/AuthGuard.tsx`（3.6 节，进度 UI）

**验证**：`pnpm dev:desktop`（恢复多个会话时显示进度）

---

### 任务 7：实现非活跃会话降频

**修改文件**：`packages/matrix-client/src/session-manager.ts`（3.7 节，`throttleInactiveSessions`）

**验证**：`pnpm typecheck`

---

### 任务 8：适配 UI 层（useTimeline 等）

**修改文件**：
- `packages/ui/src/hooks/useTimeline.ts`（typing 查询加 sessionId）
- 其他引用 `useTypingStore` 的组件

**验证**：`pnpm typecheck`

---

### 任务 9：更新导出 + 全局验证

**修改文件**：
- `packages/matrix-client/src/index.ts`（追加 `onRestoreProgress`、`cleanupAllPollers`）

**验证**：
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 登录两个服务器 → 切换 → 验证消息不串 → 重启验证进度
```

完成后提交：
```bash
git add -A
git commit -m "fix: 017 - per-session store isolation, secure token storage, restore progress"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `immer` + 深层嵌套 `sessionRooms` 性能问题 | 大量房间时 store 更新慢 | immer 的 Proxy 对浅层更新很快，`sessionRooms[id][roomId]` 只有两层——可接受 |
| `crypto.subtle` 在 HTTP（非 HTTPS）环境不可用 | Web 端开发环境加密失败 | try-catch 降级到明文存储，仅影响 `localhost` 开发 |
| 降频后非活跃会话的通知可能延迟 | @提及通知最多延迟 30 秒 | sync 本身不停止，只是降低未读计数轮询频率——消息仍实时到达，通知仍实时触发 |
| `useRoomStore` 的 getter `rooms` 在 immer 中可能不触发 re-render | UI 不更新 | 使用 Zustand selector `useRoomStore((s) => s.sessionRooms[s.activeSessionId])` 替代 getter |