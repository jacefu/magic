# Spec 002: Matrix SDK 封装层（@magic/matrix-client）

> 优先级: P0 | 波次: Wave 1 | 预估: 3-4 天 | 前置依赖: 001-monorepo-scaffold

---

## 1. 目标

在 `packages/matrix-client` 中实现对 matrix-js-sdk v41.3.0 的完整封装，提供类型安全、面向业务的 API 层。封装层负责三件事：管理 MatrixClient 生命周期（创建/登录/同步/销毁）、将 SDK 的 EventEmitter 事件桥接到 Zustand store、以及提供 Magic 自定义事件的发送/读取辅助函数。

### 用户故事

- 作为 UI 开发者，我希望 import `@magic/matrix-client` 后通过简单的 `login()` / `logout()` 完成认证，无需了解 SDK 底层细节
- 作为 UI 开发者，我希望通过 Zustand store 的 `useRoomStore()` / `useSyncStore()` 直接获取响应式的房间列表和同步状态，而不是手动监听 EventEmitter
- 作为 UI 开发者，我希望通过 `sendAgentStatus()` / `sendTaskAssignment()` 等类型安全的函数发送 Magic 自定义事件，而不是手写 event type 字符串
- 作为 Electron 开发者，我希望 SDK 封装层可以在 renderer 进程中独立运行，不依赖 Electron IPC

---

## 2. 架构设计

### 2.1 核心设计原则

1. **MatrixClient 运行在 renderer 进程**：`initRustCrypto()` 依赖 IndexedDB，仅浏览器上下文可用
2. **单例模式**：整个应用只有一个 MatrixClient 实例，通过模块级变量持有
3. **事件桥接而非事件透传**：SDK 的 EventEmitter 事件被 bridge 函数转换为 Zustand store 更新，UI 层永远不直接监听 SDK 事件
4. **平台无关**：封装层不引入任何 Electron 或 Node.js 特有 API，可同时用于桌面端和 Web 端

### 2.2 模块划分

```
packages/matrix-client/src/
├── index.ts                 # 公共 API 导出
├── client.ts                # MatrixClient 生命周期管理（单例）
├── auth.ts                  # 登录/登出/会话恢复
├── sync.ts                  # 同步控制与状态
├── rooms.ts                 # 房间 CRUD 操作
├── messages.ts              # 消息发送/时间线读取
├── crypto.ts                # E2EE 初始化与设备验证
├── files.ts                 # 文件上传/下载/MXC URI 解析
├── custom-events.ts         # Magic 自定义事件收发
├── bridge.ts                # SDK EventEmitter → Zustand 桥接
├── stores/                  # Zustand stores
│   ├── index.ts
│   ├── syncStore.ts
│   ├── roomStore.ts
│   ├── userStore.ts
│   ├── typingStore.ts
│   └── uiStore.ts
├── serializers.ts           # MatrixEvent → 可序列化 POJO 转换
├── types.ts                 # 内部类型定义
└── errors.ts                # 统一错误类型
```

### 2.3 数据流

```
matrix-js-sdk (EventEmitter)
        ↓ bridge.ts 监听
Zustand Stores (响应式状态)
        ↓ React hooks 订阅
UI Components (自动重渲染)
```

---

## 3. 技术规格

### 3.1 依赖安装

```json
{
  "dependencies": {
    "matrix-js-sdk": "^41.3.0",
    "@magic/shared-types": "workspace:*",
    "zustand": "^5.0.0",
    "immer": "^10.1.0"
  },
  "devDependencies": {
    "tsup": "^8.4.0",
    "vitest": "^3.2.0",
    "typescript": "^5.8.0",
    "@types/node": "^22.0.0"
  }
}
```

### 3.2 client.ts — MatrixClient 单例管理

```typescript
// packages/matrix-client/src/client.ts
import { createClient, MatrixClient } from "matrix-js-sdk";

let client: MatrixClient | null = null;

/**
 * 获取当前 MatrixClient 实例。
 * 如果未初始化则抛出错误。
 */
export function getClient(): MatrixClient {
  if (!client) {
    throw new MagicClientError("MatrixClient 未初始化，请先调用 initClient()");
  }
  return client;
}

/**
 * 创建并初始化 MatrixClient 实例。
 * 不执行登录——仅创建实例并初始化加密。
 */
export async function initClient(options: InitClientOptions): Promise<MatrixClient> {
  if (client) {
    await destroyClient();
  }

  client = createClient({
    baseUrl: options.homeserver,
    accessToken: options.accessToken,
    userId: options.userId,
    deviceId: options.deviceId,
    timelineSupport: true,
    useAuthorizationHeader: true,
  });

  // 初始化 Rust E2EE（必须在 startClient 之前）
  if (options.enableCrypto !== false) {
    await client.initRustCrypto();
  }

  return client;
}

/**
 * 销毁 MatrixClient 实例，停止同步，清理资源。
 */
export async function destroyClient(): Promise<void> {
  if (client) {
    client.stopClient();
    client.removeAllListeners();
    client = null;
  }
}

export function hasClient(): boolean {
  return client !== null;
}

// ---- 类型 ----
export interface InitClientOptions {
  homeserver: string;
  accessToken?: string;
  userId?: string;
  deviceId?: string;
  enableCrypto?: boolean;
}
```

### 3.3 auth.ts — 认证流程

```typescript
// packages/matrix-client/src/auth.ts
import { getClient, initClient, destroyClient } from "./client";
import type { LoginResponse } from "@magic/shared-types";

const SESSION_KEY = "magic_session";

/**
 * 用户名密码登录。
 * 创建客户端 → 登录 → 保存会话 → 启动同步。
 */
export async function login(
  homeserver: string,
  username: string,
  password: string,
): Promise<LoginResponse> {
  const client = await initClient({ homeserver });
  const response = await client.loginWithPassword(username, password);

  const session: LoginResponse = {
    userId: response.user_id,
    deviceId: response.device_id,
    accessToken: response.access_token,
    homeserver,
  };

  saveSession(session);
  return session;
}

/**
 * 从本地存储恢复会话。
 * 返回 true 表示恢复成功，false 表示无有效会话。
 */
export async function restoreSession(): Promise<boolean> {
  const session = loadSession();
  if (!session) return false;

  try {
    await initClient({
      homeserver: session.homeserver,
      accessToken: session.accessToken,
      userId: session.userId,
      deviceId: session.deviceId,
    });
    return true;
  } catch {
    clearSession();
    return false;
  }
}

/**
 * 登出并清理所有状态。
 */
export async function logout(): Promise<void> {
  try {
    const client = getClient();
    await client.logout(true); // 通知服务器
  } catch {
    // 即使服务端登出失败，本地也要清理
  }
  clearSession();
  await destroyClient();
}

// ---- 会话持久化（localStorage） ----
function saveSession(session: LoginResponse): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage 不可用时静默失败（如隐私模式）
  }
}

function loadSession(): LoginResponse | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // 静默
  }
}
```

### 3.4 sync.ts — 同步控制

```typescript
// packages/matrix-client/src/sync.ts
import { getClient } from "./client";

/**
 * 启动同步。通常在登录或会话恢复成功后调用。
 */
export async function startSync(options?: SyncOptions): Promise<void> {
  const client = getClient();
  await client.startClient({
    initialSyncLimit: options?.initialSyncLimit ?? 20,
    lazyLoadMembers: options?.lazyLoadMembers ?? true,
  });
}

/**
 * 停止同步（不销毁客户端）。
 */
export function stopSync(): void {
  const client = getClient();
  client.stopClient();
}

export interface SyncOptions {
  initialSyncLimit?: number;
  lazyLoadMembers?: boolean;
}
```

### 3.5 rooms.ts — 房间操作

```typescript
// packages/matrix-client/src/rooms.ts
import { getClient } from "./client";
import type { Room } from "matrix-js-sdk";

export async function createRoom(options: CreateRoomOptions): Promise<string> {
  const client = getClient();
  const { room_id } = await client.createRoom({
    name: options.name,
    topic: options.topic,
    preset: options.encrypted ? "private_chat" : "public_chat",
    invite: options.invite,
    initial_state: options.encrypted
      ? [{ type: "m.room.encryption", content: { algorithm: "m.megolm.v1.aes-sha2" } }]
      : undefined,
  });
  return room_id;
}

export async function joinRoom(roomIdOrAlias: string): Promise<string> {
  const client = getClient();
  const { roomId } = await client.joinRoom(roomIdOrAlias);
  return roomId;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const client = getClient();
  await client.leave(roomId);
}

export async function inviteUser(roomId: string, userId: string): Promise<void> {
  const client = getClient();
  await client.invite(roomId, userId);
}

export function getRooms(): Room[] {
  const client = getClient();
  return client.getRooms();
}

export function getRoom(roomId: string): Room | null {
  const client = getClient();
  return client.getRoom(roomId);
}

export interface CreateRoomOptions {
  name: string;
  topic?: string;
  invite?: string[];
  encrypted?: boolean;
}
```

### 3.6 messages.ts — 消息收发

```typescript
// packages/matrix-client/src/messages.ts
import { getClient } from "./client";
import { Direction } from "matrix-js-sdk";

/**
 * 发送文本消息（支持 Markdown/HTML）。
 */
export async function sendTextMessage(
  roomId: string,
  body: string,
  html?: string,
): Promise<string> {
  const client = getClient();
  const content: Record<string, string> = {
    msgtype: "m.text",
    body,
  };
  if (html) {
    content.format = "org.matrix.custom.html";
    content.formatted_body = html;
  }
  const { event_id } = await client.sendMessage(roomId, content);
  return event_id;
}

/**
 * 发送回复消息。
 */
export async function sendReply(
  roomId: string,
  body: string,
  replyToEventId: string,
  html?: string,
): Promise<string> {
  const client = getClient();
  const room = client.getRoom(roomId);
  const replyEvent = room?.findEventById(replyToEventId);

  const content: Record<string, unknown> = {
    msgtype: "m.text",
    body,
    "m.relates_to": {
      "m.in_reply_to": { event_id: replyToEventId },
    },
  };
  if (html) {
    content.format = "org.matrix.custom.html";
    content.formatted_body = html;
  }
  const { event_id } = await client.sendMessage(roomId, content);
  return event_id;
}

/**
 * 发送已读回执。
 */
export async function sendReadReceipt(roomId: string, eventId: string): Promise<void> {
  const client = getClient();
  const room = client.getRoom(roomId);
  const event = room?.findEventById(eventId);
  if (event) {
    await client.sendReadReceipt(event);
  }
}

/**
 * 发送输入提示。
 */
export async function sendTyping(roomId: string, isTyping: boolean): Promise<void> {
  const client = getClient();
  await client.sendTyping(roomId, isTyping, isTyping ? 30000 : 0);
}

/**
 * 向上分页加载历史消息。
 */
export async function paginateBackwards(
  roomId: string,
  limit: number = 30,
): Promise<boolean> {
  const client = getClient();
  const room = client.getRoom(roomId);
  if (!room) return false;

  const timeline = room.getLiveTimeline();
  return client.paginateEventTimeline(timeline, {
    backwards: true,
    limit,
  });
}
```

### 3.7 files.ts — 文件处理

```typescript
// packages/matrix-client/src/files.ts
import { getClient } from "./client";

/**
 * 上传文件并发送到房间。
 */
export async function uploadAndSendFile(
  roomId: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void,
): Promise<string> {
  const client = getClient();

  // 上传文件
  const { content_uri } = await client.uploadContent(file, {
    name: file.name,
    type: file.type,
    progressHandler: onProgress
      ? ({ loaded, total }) => onProgress(loaded, total)
      : undefined,
  });

  // 发送文件消息
  const content: Record<string, unknown> = {
    msgtype: getMessageType(file.type),
    body: file.name,
    url: content_uri,
    info: {
      mimetype: file.type,
      size: file.size,
    },
  };

  const { event_id } = await client.sendMessage(roomId, content);
  return event_id;
}

/**
 * 将 MXC URI 解析为 HTTP URL（带认证）。
 */
export function mxcToHttp(
  mxcUri: string,
  width?: number,
  height?: number,
  resizeMethod?: "crop" | "scale",
): string | null {
  const client = getClient();
  return client.mxcUrlToHttp(
    mxcUri,
    width,
    height,
    resizeMethod ?? "scale",
    false,  // allowDirect
    true,   // allowRedirects
    true,   // useAuthentication (Matrix 1.11+)
  );
}

function getMessageType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "m.image";
  if (mimeType.startsWith("video/")) return "m.video";
  if (mimeType.startsWith("audio/")) return "m.audio";
  return "m.file";
}
```

### 3.8 custom-events.ts — Magic 自定义事件

```typescript
// packages/matrix-client/src/custom-events.ts
import { getClient } from "./client";
import {
  MAGIC_EVENTS,
  AgentStatusEvent,
  TaskAssignmentEvent,
  SoulContentEvent,
} from "@magic/shared-types";

// ---- 发送 ----

export async function sendAgentStatus(
  roomId: string,
  data: AgentStatusEvent,
): Promise<string> {
  AgentStatusEvent.parse(data); // Zod 运行时校验
  const client = getClient();
  const { event_id } = await client.sendEvent(
    roomId,
    MAGIC_EVENTS.AGENT_STATUS,
    data,
  );
  return event_id;
}

export async function sendTaskAssignment(
  roomId: string,
  data: TaskAssignmentEvent,
): Promise<string> {
  TaskAssignmentEvent.parse(data);
  const client = getClient();
  const { event_id } = await client.sendStateEvent(
    roomId,
    MAGIC_EVENTS.TASK_ASSIGNMENT,
    data,
    data.task_id, // state_key
  );
  return event_id;
}

export async function sendSoulContent(
  roomId: string,
  data: SoulContentEvent,
): Promise<string> {
  SoulContentEvent.parse(data);
  const client = getClient();
  const { event_id } = await client.sendStateEvent(
    roomId,
    data.file_type === "soul"
      ? MAGIC_EVENTS.SOUL_CONTENT
      : MAGIC_EVENTS.MEMORY_CONTENT,
    data,
    "", // 每个房间只保留一份 SOUL/MEMORY
  );
  return event_id;
}

// ---- 读取 ----

export function getAgentStatuses(roomId: string): AgentStatusEvent[] {
  const client = getClient();
  const room = client.getRoom(roomId);
  if (!room) return [];

  const events = room.currentState.getStateEvents(MAGIC_EVENTS.AGENT_STATUS);
  return events
    .map((e) => {
      const result = AgentStatusEvent.safeParse(e.getContent());
      return result.success ? result.data : null;
    })
    .filter((e): e is AgentStatusEvent => e !== null);
}

export function getTaskAssignments(roomId: string): TaskAssignmentEvent[] {
  const client = getClient();
  const room = client.getRoom(roomId);
  if (!room) return [];

  const events = room.currentState.getStateEvents(MAGIC_EVENTS.TASK_ASSIGNMENT);
  return events
    .map((e) => {
      const result = TaskAssignmentEvent.safeParse(e.getContent());
      return result.success ? result.data : null;
    })
    .filter((e): e is TaskAssignmentEvent => e !== null);
}

export function getSoulContent(
  roomId: string,
  fileType: "soul" | "memory",
): SoulContentEvent | null {
  const client = getClient();
  const room = client.getRoom(roomId);
  if (!room) return null;

  const eventType = fileType === "soul"
    ? MAGIC_EVENTS.SOUL_CONTENT
    : MAGIC_EVENTS.MEMORY_CONTENT;
  const event = room.currentState.getStateEvents(eventType, "");
  if (!event) return null;

  const result = SoulContentEvent.safeParse(event.getContent());
  return result.success ? result.data : null;
}
```

### 3.9 serializers.ts — 事件序列化

```typescript
// packages/matrix-client/src/serializers.ts
import type { MatrixEvent } from "matrix-js-sdk";
import type { SerializedMatrixEvent } from "@magic/shared-types";

/**
 * 将 matrix-js-sdk 的 MatrixEvent 转为可序列化 POJO。
 * 用于存入 Zustand store 和跨 IPC 传输。
 */
export function serializeEvent(event: MatrixEvent): SerializedMatrixEvent {
  return {
    eventId: event.getId() ?? "",
    roomId: event.getRoomId() ?? "",
    type: event.getType(),
    sender: event.getSender() ?? "",
    content: event.getContent(),
    timestamp: event.getTs(),
    unsigned: event.getUnsigned(),
  };
}

/**
 * 从房间成员对象提取显示名和头像。
 */
export function serializeRoomMember(member: {
  userId: string;
  name: string;
  getMxcAvatarUrl: () => string | null;
}): SerializedMember {
  return {
    userId: member.userId,
    displayName: member.name,
    avatarMxc: member.getMxcAvatarUrl() ?? undefined,
  };
}

export interface SerializedMember {
  userId: string;
  displayName: string;
  avatarMxc?: string;
}
```

### 3.10 errors.ts — 统一错误类型

```typescript
// packages/matrix-client/src/errors.ts

export class MagicClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MagicClientError";
  }
}

export class AuthError extends MagicClientError {
  constructor(message: string, cause?: unknown) {
    super(message, "AUTH_ERROR", cause);
    this.name = "AuthError";
  }
}

export class SyncError extends MagicClientError {
  constructor(message: string, cause?: unknown) {
    super(message, "SYNC_ERROR", cause);
    this.name = "SyncError";
  }
}

export class RoomError extends MagicClientError {
  constructor(message: string, cause?: unknown) {
    super(message, "ROOM_ERROR", cause);
    this.name = "RoomError";
  }
}
```

### 3.11 stores/ — Zustand Stores

#### syncStore.ts

```typescript
// packages/matrix-client/src/stores/syncStore.ts
import { create } from "zustand";

export type SyncState = "STOPPED" | "SYNCING" | "PREPARED" | "ERROR" | "RECONNECTING";

interface SyncStoreState {
  syncState: SyncState;
  lastSyncError: string | null;
  initialSyncComplete: boolean;
  setSyncState: (state: SyncState) => void;
  setSyncError: (error: string | null) => void;
  setInitialSyncComplete: () => void;
  reset: () => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  syncState: "STOPPED",
  lastSyncError: null,
  initialSyncComplete: false,
  setSyncState: (syncState) => set({ syncState }),
  setSyncError: (lastSyncError) => set({ lastSyncError }),
  setInitialSyncComplete: () => set({ initialSyncComplete: true }),
  reset: () => set({
    syncState: "STOPPED",
    lastSyncError: null,
    initialSyncComplete: false,
  }),
}));
```

#### roomStore.ts

```typescript
// packages/matrix-client/src/stores/roomStore.ts
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
  rooms: Record<string, RoomData>;
  activeRoomId: string | null;

  // Actions
  setActiveRoom: (roomId: string | null) => void;
  upsertRoom: (roomId: string, data: Partial<RoomData>) => void;
  removeRoom: (roomId: string) => void;
  addMessage: (roomId: string, event: SerializedMatrixEvent) => void;
  prependMessages: (roomId: string, events: SerializedMatrixEvent[]) => void;
  setUnreadCount: (roomId: string, count: number, highlight: number) => void;
  reset: () => void;
}

function createDefaultRoom(roomId: string): RoomData {
  return {
    roomId,
    name: "",
    topic: "",
    avatarMxc: null,
    memberCount: 0,
    unreadCount: 0,
    highlightCount: 0,
    timeline: [],
    lastMessage: null,
    isEncrypted: false,
    isDirect: false,
    lastActivityTs: 0,
  };
}

export const useRoomStore = create<RoomStoreState>()(
  immer((set) => ({
    rooms: {},
    activeRoomId: null,

    setActiveRoom: (roomId) => set((s) => {
      s.activeRoomId = roomId;
    }),

    upsertRoom: (roomId, data) => set((s) => {
      if (!s.rooms[roomId]) {
        s.rooms[roomId] = createDefaultRoom(roomId);
      }
      Object.assign(s.rooms[roomId], data);
    }),

    removeRoom: (roomId) => set((s) => {
      delete s.rooms[roomId];
      if (s.activeRoomId === roomId) {
        s.activeRoomId = null;
      }
    }),

    addMessage: (roomId, event) => set((s) => {
      if (!s.rooms[roomId]) {
        s.rooms[roomId] = createDefaultRoom(roomId);
      }
      const room = s.rooms[roomId];
      // 去重
      if (!room.timeline.some((e) => e.eventId === event.eventId)) {
        room.timeline.push(event);
        room.lastMessage = event;
        room.lastActivityTs = event.timestamp;
      }
    }),

    prependMessages: (roomId, events) => set((s) => {
      if (!s.rooms[roomId]) return;
      const existing = new Set(s.rooms[roomId].timeline.map((e) => e.eventId));
      const newEvents = events.filter((e) => !existing.has(e.eventId));
      s.rooms[roomId].timeline.unshift(...newEvents);
    }),

    setUnreadCount: (roomId, count, highlight) => set((s) => {
      if (s.rooms[roomId]) {
        s.rooms[roomId].unreadCount = count;
        s.rooms[roomId].highlightCount = highlight;
      }
    }),

    reset: () => set({ rooms: {}, activeRoomId: null }),
  }))
);
```

#### typingStore.ts

```typescript
// packages/matrix-client/src/stores/typingStore.ts
import { create } from "zustand";

interface TypingStoreState {
  /** roomId → Set<userId> */
  typing: Record<string, string[]>;
  setTyping: (roomId: string, userId: string, isTyping: boolean) => void;
  clearRoom: (roomId: string) => void;
  reset: () => void;
}

export const useTypingStore = create<TypingStoreState>((set) => ({
  typing: {},

  setTyping: (roomId, userId, isTyping) => set((s) => {
    const current = new Set(s.typing[roomId] ?? []);
    if (isTyping) {
      current.add(userId);
    } else {
      current.delete(userId);
    }
    return { typing: { ...s.typing, [roomId]: Array.from(current) } };
  }),

  clearRoom: (roomId) => set((s) => {
    const { [roomId]: _, ...rest } = s.typing;
    return { typing: rest };
  }),

  reset: () => set({ typing: {} }),
}));
```

#### userStore.ts

```typescript
// packages/matrix-client/src/stores/userStore.ts
import { create } from "zustand";
import type { SerializedMember } from "../serializers";

interface UserStoreState {
  /** userId → profile */
  users: Record<string, SerializedMember>;
  currentUserId: string | null;

  setCurrentUser: (userId: string) => void;
  upsertUser: (user: SerializedMember) => void;
  reset: () => void;
}

export const useUserStore = create<UserStoreState>((set) => ({
  users: {},
  currentUserId: null,

  setCurrentUser: (userId) => set({ currentUserId: userId }),

  upsertUser: (user) => set((s) => ({
    users: { ...s.users, [user.userId]: user },
  })),

  reset: () => set({ users: {}, currentUserId: null }),
}));
```

#### uiStore.ts

```typescript
// packages/matrix-client/src/stores/uiStore.ts
import { create } from "zustand";

interface UIStoreState {
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelMode: "members" | "files" | "agents" | "settings" | null;
  composerReplyTo: string | null; // eventId

  toggleSidebar: () => void;
  setRightPanel: (mode: UIStoreState["rightPanelMode"]) => void;
  closeRightPanel: () => void;
  setComposerReplyTo: (eventId: string | null) => void;
  reset: () => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  sidebarOpen: true,
  rightPanelOpen: false,
  rightPanelMode: null,
  composerReplyTo: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setRightPanel: (mode) => set({ rightPanelOpen: true, rightPanelMode: mode }),
  closeRightPanel: () => set({ rightPanelOpen: false, rightPanelMode: null }),
  setComposerReplyTo: (eventId) => set({ composerReplyTo: eventId }),
  reset: () => set({
    sidebarOpen: true,
    rightPanelOpen: false,
    rightPanelMode: null,
    composerReplyTo: null,
  }),
}));
```

### 3.12 bridge.ts — 事件桥接

```typescript
// packages/matrix-client/src/bridge.ts
import {
  ClientEvent,
  RoomEvent,
  RoomMemberEvent,
  RoomStateEvent,
  type MatrixClient,
  type Room,
} from "matrix-js-sdk";
import { useSyncStore } from "./stores/syncStore";
import { useRoomStore } from "./stores/roomStore";
import { useTypingStore } from "./stores/typingStore";
import { useUserStore } from "./stores/userStore";
import { serializeEvent } from "./serializers";
import type { SyncState } from "./stores/syncStore";

/**
 * 将 MatrixClient 的 EventEmitter 事件桥接到 Zustand stores。
 * 调用一次即可。返回 cleanup 函数用于解除绑定。
 */
export function bridgeToStores(client: MatrixClient): () => void {
  // ---- 同步状态 ----
  const onSync = (state: string, _prevState: string | null, data?: { error?: Error }) => {
    const syncStore = useSyncStore.getState();
    const mappedState = mapSyncState(state);
    syncStore.setSyncState(mappedState);

    if (state === "PREPARED") {
      syncStore.setInitialSyncComplete();
      syncRoomList(client);
    }
    if (state === "ERROR" && data?.error) {
      syncStore.setSyncError(data.error.message);
    }
  };
  client.on(ClientEvent.Sync, onSync);

  // ---- 新消息 ----
  const onTimeline = (event: any, room: Room | undefined, toStartOfTimeline: boolean | undefined) => {
    if (!room || toStartOfTimeline) return;
    const serialized = serializeEvent(event);
    useRoomStore.getState().addMessage(room.roomId, serialized);
  };
  client.on(RoomEvent.Timeline, onTimeline);

  // ---- 房间名称/主题变化 ----
  const onRoomName = (room: Room) => {
    useRoomStore.getState().upsertRoom(room.roomId, { name: room.name });
  };
  client.on(RoomEvent.Name, onRoomName);

  // ---- 未读数变化 ----
  const onUnreadCount = (room: Room) => {
    useRoomStore.getState().setUnreadCount(
      room.roomId,
      room.getUnreadNotificationCount("total") ?? 0,
      room.getUnreadNotificationCount("highlight") ?? 0,
    );
  };
  client.on(RoomEvent.UnreadNotifications, onUnreadCount);

  // ---- 输入提示 ----
  const onTyping = (_event: any, member: any) => {
    useTypingStore.getState().setTyping(
      member.roomId,
      member.userId,
      member.typing,
    );
  };
  client.on(RoomMemberEvent.Typing, onTyping);

  // ---- 成员变化 ----
  const onMembership = (room: Room, membership: string) => {
    if (membership === "invite") {
      // 可选：自动加入或提示用户
    }
    if (membership === "leave") {
      useRoomStore.getState().removeRoom(room.roomId);
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
 * 初始同步完成后，将现有房间列表同步到 store。
 */
function syncRoomList(client: MatrixClient): void {
  const rooms = client.getRooms();
  const roomStore = useRoomStore.getState();

  for (const room of rooms) {
    roomStore.upsertRoom(room.roomId, {
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

function mapSyncState(sdkState: string): SyncState {
  switch (sdkState) {
    case "PREPARED": return "PREPARED";
    case "SYNCING": return "SYNCING";
    case "ERROR": return "ERROR";
    case "RECONNECTING": return "RECONNECTING";
    case "STOPPED": return "STOPPED";
    default: return "SYNCING";
  }
}
```

### 3.13 index.ts — 公共 API 导出

```typescript
// packages/matrix-client/src/index.ts

// 客户端生命周期
export { initClient, getClient, destroyClient, hasClient } from "./client";
export type { InitClientOptions } from "./client";

// 认证
export { login, logout, restoreSession } from "./auth";

// 同步
export { startSync, stopSync } from "./sync";
export type { SyncOptions } from "./sync";

// 房间
export { createRoom, joinRoom, leaveRoom, inviteUser, getRooms, getRoom } from "./rooms";
export type { CreateRoomOptions } from "./rooms";

// 消息
export { sendTextMessage, sendReply, sendReadReceipt, sendTyping, paginateBackwards } from "./messages";

// 文件
export { uploadAndSendFile, mxcToHttp } from "./files";

// Magic 自定义事件
export {
  sendAgentStatus,
  sendTaskAssignment,
  sendSoulContent,
  getAgentStatuses,
  getTaskAssignments,
  getSoulContent,
} from "./custom-events";

// 事件桥接
export { bridgeToStores } from "./bridge";

// Zustand Stores
export { useSyncStore } from "./stores/syncStore";
export { useRoomStore } from "./stores/roomStore";
export { useTypingStore } from "./stores/typingStore";
export { useUserStore } from "./stores/userStore";
export { useUIStore } from "./stores/uiStore";
export type { RoomData } from "./stores/roomStore";
export type { SyncState } from "./stores/syncStore";

// 序列化
export { serializeEvent, serializeRoomMember } from "./serializers";
export type { SerializedMember } from "./serializers";

// 错误
export { MagicClientError, AuthError, SyncError, RoomError } from "./errors";
```

---

## 4. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | `pnpm --filter @magic/matrix-client build` 成功 | `pnpm build` |
| AC-2 | `pnpm --filter @magic/matrix-client typecheck` 无错误 | `pnpm typecheck` |
| AC-3 | `pnpm --filter @magic/matrix-client test` 所有单元测试通过 | `pnpm test` |
| AC-4 | 从 `@magic/ui` 或 `@magic/desktop` 可成功 import `{ login, useRoomStore }` 并通过 typecheck | import 测试 |
| AC-5 | `initClient()` → `login()` → `startSync()` → `bridgeToStores()` 完整流程可调用（mock 测试） | 单元测试 |
| AC-6 | `sendAgentStatus()` 对非法数据抛出 Zod 校验错误 | 单元测试 |
| AC-7 | `useRoomStore` 的 `addMessage` 正确去重 | 单元测试 |
| AC-8 | `bridgeToStores()` 返回的 cleanup 函数能正确解除所有事件监听 | 单元测试 |
| AC-9 | 不引入任何 Electron / Node.js 特有 API（`fs`、`path`、`electron` 等） | 代码审查 |

---

## 5. 实现任务（按执行顺序）

### 任务 1：安装依赖并更新 package.json

**描述**：在 `packages/matrix-client/` 中安装 matrix-js-sdk、zustand、immer。

**命令**：
```bash
cd packages/matrix-client
pnpm add matrix-js-sdk@^41.3.0 zustand@^5.0.0 immer@^10.1.0
```

**验证**：`pnpm install && pnpm typecheck`

---

### 任务 2：创建 errors.ts 和 types.ts

**描述**：创建统一错误类型和内部类型定义。

**创建文件**：
- `src/errors.ts`
- `src/types.ts`（可为空，后续扩展用）

**验证**：`pnpm typecheck`

---

### 任务 3：创建 client.ts 和 serializers.ts

**描述**：实现 MatrixClient 单例管理和事件序列化。

**创建文件**：
- `src/client.ts`
- `src/serializers.ts`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 auth.ts 和 sync.ts

**描述**：实现登录/登出/会话恢复和同步控制。

**创建文件**：
- `src/auth.ts`
- `src/sync.ts`

**验证**：`pnpm typecheck`

---

### 任务 5：创建 rooms.ts、messages.ts、files.ts

**描述**：实现房间 CRUD、消息收发、文件处理。

**创建文件**：
- `src/rooms.ts`
- `src/messages.ts`
- `src/files.ts`

**验证**：`pnpm typecheck`

---

### 任务 6：创建 custom-events.ts

**描述**：实现 Magic 自定义事件的类型安全收发函数。

**创建文件**：
- `src/custom-events.ts`

**验证**：`pnpm typecheck`

---

### 任务 7：创建所有 Zustand stores

**描述**：创建 5 个 Zustand store。

**创建文件**：
- `src/stores/index.ts`
- `src/stores/syncStore.ts`
- `src/stores/roomStore.ts`
- `src/stores/typingStore.ts`
- `src/stores/userStore.ts`
- `src/stores/uiStore.ts`

**验证**：`pnpm typecheck`

---

### 任务 8：创建 bridge.ts

**描述**：实现 SDK EventEmitter → Zustand store 的桥接函数。

**创建文件**：
- `src/bridge.ts`

**验证**：`pnpm typecheck`

---

### 任务 9：更新 index.ts 公共 API 导出

**描述**：更新 `src/index.ts`，导出所有公共 API。

**修改文件**：
- `src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 10：编写单元测试

**描述**：为核心模块编写单元测试，使用 vitest mock matrix-js-sdk。

**创建/更新文件**：
- `__tests__/client.test.ts` — 单例管理测试
- `__tests__/auth.test.ts` — 登录/登出/会话恢复测试
- `__tests__/rooms.test.ts` — 房间操作测试
- `__tests__/custom-events.test.ts` — Zod 校验 + 事件收发测试
- `__tests__/stores.test.ts` — Zustand store 行为测试（addMessage 去重、setUnreadCount 等）
- `__tests__/bridge.test.ts` — 桥接函数 + cleanup 测试

**验证**：`pnpm test`（全部通过）

---

### 任务 11：全局集成验证

**描述**：从根目录确认整个 monorepo 仍然正常。

**验证**：
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

完成后提交：
```bash
git add -A
git commit -m "feat: 002 - @magic/matrix-client SDK wrapper with Zustand bridge"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| matrix-js-sdk 类型定义不完整 | 某些 API 调用需要 `as any` | 用 TypeScript 的 `// @ts-expect-error` + 注释记录，后续 SDK 升级后移除 |
| `initRustCrypto()` 在 Node.js 测试中不可用 | 单元测试无法覆盖加密流程 | 测试中 mock `initRustCrypto()`，加密集成测试推迟到 008-e2ee-setup |
| Zustand v5 immer 中间件 API 变化 | store 定义语法不兼容 | 锁定 zustand@^5.0.0，参考官方 migration guide |
| `localStorage` 在 SSR / Worker 中不可用 | 会话持久化失败 | auth.ts 中 try-catch 包裹，静默降级 |

---

## 7. 后续 Spec 的接入点

- **003-electron-shell**：在 main 进程 IPC handler 中调用 `@magic/matrix-client` 的序列化函数，将通知推送到原生 OS
- **004-auth-flow**：UI 层调用 `login()` / `restoreSession()` / `logout()`
- **005-room-list-sidebar**：UI 层订阅 `useRoomStore()` 渲染房间列表
- **006-chat-timeline**：UI 层订阅 `useRoomStore().rooms[roomId].timeline` 渲染消息
- **008-e2ee-setup**：扩展 `crypto.ts`（本 spec 中预留了空壳）