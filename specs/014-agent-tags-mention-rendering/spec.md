# Spec 014: Agent 标识与提及渲染（Agent Tags & Mention Rendering）

> 优先级: P0 | 波次: Wave 4 | 预估: 2-3 天 | 前置依赖: 010-agent-status-dashboard, 012-mentions, 013-ui-restructure
> 文件路径: `specs/014-agent-tags-mention-rendering/spec.md`

---

## 1. 目标

将 Agent 运行时标识和 @mention 渲染从"spec 定义"落地到"可见可交互"的完整实现，同时建立**准确的 Agent 身份识别**和**在线状态判断**机制。

### 8 个功能点（对应截图红框）

| # | 区域 | 功能 |
|---|------|------|
| 1 | 房间列表 | `▾ 私聊` 分组 + DM 项前的绿/黄/灰在线状态圆点 |
| 2 | 消息时间线 | `@worker-alice` 蓝色高亮 mention pill |
| 3 | 消息时间线 | `AGENT` 运行时标签（紧跟发送者名） |
| 4 | 消息时间线 | `HERMES` 运行时标签 |
| 5 | 成员面板 | `在线 — 3` 分组标题 |
| 6 | 成员面板 | `AGENT` 运行时标签（成员名旁） |
| 7 | 成员面板 | `HERMES` 运行时标签 |
| 8 | 成员面板 | `离线 — 2` 分组标题 |

---

## 2. 关键设计决策：如何判断 Agent vs 真人？如何判断在线？

### 2.1 判断 Agent vs 真人

**问题**：Matrix 协议本身不区分 Agent 和真人——都是 Matrix 用户。必须依赖外部数据源。

**方案：HiClaw CRD API 为权威数据源**

```
登录后调用一次:
  GET {hiclaw-controller}/api/v1/workers  → 全量 Worker 列表（含 userId、runtime、model）
  GET {hiclaw-controller}/api/v1/managers → Manager 信息（含 userId）

结果存入 agentRegistryStore，后续所有判断基于此 Store。
```

| 层级 | 方法 | 准确度 | 说明 |
|------|------|--------|------|
| **第 1 优先** | HiClaw CRD API 返回的 Worker/Manager userId 列表 | ✅ 100% 准确 | 控制器创建 Agent 时注册的 Matrix 账号 |
| **第 2 优先** | `agentStore` 中收到过 `com.magic.agent.status` 事件的 userId | ✅ 准确 | 运行中的 Agent 会定期发此事件 |
| **第 3 回退** | 用户名模式匹配（`worker-*`、`hermes-*`、`manager`） | ⚠️ 不可靠 | 仅用于 CRD API 不可用时的降级 |

### 2.2 判断在线状态

**Agent 和真人的在线判断使用不同的数据源**：

| 类型 | 数据源 | 机制 | 精度 |
|------|--------|------|------|
| **Agent** | `com.magic.agent.status` 事件的 `status` 字段 + `com.magic.heartbeat` 事件 | Agent 运行时每 30 秒发一次心跳，60 秒无心跳判定离线 | 高 |
| **真人** | Matrix Presence API（`m.presence` 事件） | Matrix 原生能力，用户客户端上线/离线/空闲会广播 presence | 中（Tuwunel 可能默认关闭） |
| **真人（降级）** | 房间 typing 事件 / 最后消息时间 | 如果 Presence 不可用，回退到"最近 5 分钟有活动"粗略判断 | 低 |

**Matrix Presence 事件格式**：

```json
{
  "type": "m.presence",
  "sender": "@jacefu:magic.com",
  "content": {
    "presence": "online",       // online | unavailable | offline
    "last_active_ago": 5000,    // 毫秒
    "currently_active": true,
    "status_msg": "Working on MAGIC Client"
  }
}
```

---

## 3. 文件结构

```
packages/
├── matrix-client/src/
│   ├── stores/
│   │   ├── agentRegistryStore.ts    # 新增：从 CRD API 获取的 Agent 注册表
│   │   └── presenceStore.ts         # 新增：Matrix Presence 状态
│   ├── presence.ts                  # 新增：Presence 事件监听
│   └── agent-registry.ts           # 新增：HiClaw CRD API 调用
│
├── ui/src/
│   ├── lib/
│   │   └── agentDetection.ts        # 新增：统一 Agent 检测（三层回退）
│   ├── agents/
│   │   └── AgentTag.tsx             # 新增：通用运行时标签组件
│   ├── mentions/
│   │   └── MentionPill.tsx          # 更新：样式确认
│   ├── chat/
│   │   ├── MessageBubble.tsx        # 更新：渲染 AgentTag
│   │   └── TextMessage.tsx          # 更新：渲染 MentionPill
│   ├── rooms/
│   │   └── RoomListItem.tsx         # 更新：DM 状态圆点对接真实数据
│   ├── panels/
│   │   └── MemberPanel.tsx          # 更新：统一使用 AgentTag + 状态检测
│   └── hooks/
│       └── useRoomMembers.ts        # 更新：增强 Agent 识别
```

---

## 4. 技术规格

### 4.1 agentRegistryStore.ts — Agent 注册表（从 CRD API）

```typescript
// packages/matrix-client/src/stores/agentRegistryStore.ts
import { create } from "zustand";

export interface RegisteredAgent {
  /** Worker/Manager 在 Matrix 中的 userId，如 @worker-alice:magic.com */
  userId: string;
  /** CRD 中的 metadata.name，如 alice */
  name: string;
  /** 运行时类型 */
  runtime: "openclaw" | "hermes" | "qwenpaw";
  /** 模型名，如 qwen3.5-plus */
  model?: string;
  /** 角色类型 */
  role: "worker" | "manager";
}

interface AgentRegistryState {
  /** userId → RegisteredAgent */
  agents: Record<string, RegisteredAgent>;
  /** 是否已从 CRD API 加载 */
  loaded: boolean;
  /** 加载错误 */
  error: string | null;

  setAgents: (agents: RegisteredAgent[]) => void;
  setLoaded: (loaded: boolean) => void;
  setError: (error: string | null) => void;
  isAgent: (userId: string) => boolean;
  getAgent: (userId: string) => RegisteredAgent | null;
  reset: () => void;
}

export const useAgentRegistryStore = create<AgentRegistryState>((set, get) => ({
  agents: {},
  loaded: false,
  error: null,

  setAgents: (agents) => {
    const map: Record<string, RegisteredAgent> = {};
    for (const a of agents) {
      map[a.userId] = a;
    }
    set({ agents: map, loaded: true, error: null });
  },

  setLoaded: (loaded) => set({ loaded }),
  setError: (error) => set({ error, loaded: true }),

  isAgent: (userId) => userId in get().agents,
  getAgent: (userId) => get().agents[userId] ?? null,

  reset: () => set({ agents: {}, loaded: false, error: null }),
}));
```

### 4.2 agent-registry.ts — HiClaw CRD API 调用

```typescript
// packages/matrix-client/src/agent-registry.ts
import { useAgentRegistryStore, type RegisteredAgent } from "./stores/agentRegistryStore";

/**
 * 从 HiClaw Controller 的 CRD API 获取全量 Agent 列表。
 * 登录并同步完成后调用一次。
 *
 * API 端点：
 *   GET {controllerUrl}/api/v1/workers  → Worker 列表
 *   GET {controllerUrl}/api/v1/managers → Manager 信息
 */
export async function fetchAgentRegistry(controllerUrl: string): Promise<void> {
  const store = useAgentRegistryStore.getState();

  try {
    const agents: RegisteredAgent[] = [];

    // 获取 Workers
    const workersRes = await fetch(`${controllerUrl}/api/v1/workers`);
    if (workersRes.ok) {
      const workersData = await workersRes.json();
      const workers = Array.isArray(workersData) ? workersData : workersData.items ?? [];

      for (const w of workers) {
        const name = w.metadata?.name ?? w.name ?? "";
        const spec = w.spec ?? {};
        agents.push({
          userId: w.status?.matrixUserId ?? `@worker-${name}:${getHomeserverDomain()}`,
          name,
          runtime: normalizeRuntime(spec.runtime),
          model: spec.model,
          role: "worker",
        });
      }
    }

    // 获取 Manager
    const managerRes = await fetch(`${controllerUrl}/api/v1/managers`);
    if (managerRes.ok) {
      const managerData = await managerRes.json();
      const managers = Array.isArray(managerData) ? managerData : [managerData];

      for (const m of managers) {
        const name = m.metadata?.name ?? "manager";
        agents.push({
          userId: m.status?.matrixUserId ?? `@${name}:${getHomeserverDomain()}`,
          name,
          runtime: normalizeRuntime(m.spec?.runtime ?? "openclaw"),
          model: m.spec?.model,
          role: "manager",
        });
      }
    }

    store.setAgents(agents);
  } catch (err: any) {
    console.warn("HiClaw CRD API 不可用，回退到事件检测模式:", err.message);
    store.setError(err.message);
    store.setLoaded(true);
  }
}

function normalizeRuntime(raw: string | undefined): RegisteredAgent["runtime"] {
  const r = (raw ?? "").toLowerCase();
  if (r.includes("hermes")) return "hermes";
  if (r.includes("copaw") || r.includes("qwenpaw")) return "qwenpaw";
  return "openclaw";
}

function getHomeserverDomain(): string {
  // 从 authStore 获取，或使用默认值
  try {
    const { homeserver } = require("./stores/authStore").useAuthStore.getState();
    if (homeserver) {
      return new URL(homeserver).hostname;
    }
  } catch {}
  return "matrix.magic.com";
}
```

### 4.3 presenceStore.ts — Matrix Presence 状态

```typescript
// packages/matrix-client/src/stores/presenceStore.ts
import { create } from "zustand";

export type PresenceState = "online" | "unavailable" | "offline";

interface PresenceData {
  presence: PresenceState;
  lastActiveAgo?: number;
  currentlyActive?: boolean;
  statusMsg?: string;
  updatedAt: number;
}

interface PresenceStoreState {
  /** userId → PresenceData */
  presences: Record<string, PresenceData>;

  setPresence: (userId: string, data: Omit<PresenceData, "updatedAt">) => void;
  getPresence: (userId: string) => PresenceData | null;
  reset: () => void;
}

export const usePresenceStore = create<PresenceStoreState>((set, get) => ({
  presences: {},

  setPresence: (userId, data) => set((s) => ({
    presences: {
      ...s.presences,
      [userId]: { ...data, updatedAt: Date.now() },
    },
  })),

  getPresence: (userId) => get().presences[userId] ?? null,

  reset: () => set({ presences: {} }),
}));
```

### 4.4 presence.ts — Presence 事件监听

```typescript
// packages/matrix-client/src/presence.ts
import { ClientEvent, type MatrixClient } from "matrix-js-sdk";
import { usePresenceStore, type PresenceState } from "./stores/presenceStore";

/**
 * 监听 Matrix Presence 事件，更新 presenceStore。
 * 在 bridgeToStores() 中调用。
 */
export function bridgePresence(client: MatrixClient): () => void {
  const onPresence = (event: any) => {
    const sender = event.getSender();
    const content = event.getContent();
    if (!sender || !content.presence) return;

    usePresenceStore.getState().setPresence(sender, {
      presence: content.presence as PresenceState,
      lastActiveAgo: content.last_active_ago,
      currentlyActive: content.currently_active,
      statusMsg: content.status_msg,
    });
  };

  client.on("event" as any, (event: any) => {
    if (event.getType() === "m.presence") {
      onPresence(event);
    }
  });

  // 初始加载：获取已知用户的 presence
  // （Tuwunel 可能不支持，会静默失败）
  try {
    // matrix-js-sdk 不直接暴露 batch presence 查询
    // 依赖服务器推送的 m.presence 事件
  } catch {}

  return () => {
    // cleanup 在 bridgeToStores 的 cleanup 中统一处理
  };
}
```

### 4.5 更新 bridge.ts — 追加 Presence 和 Agent Registry

```typescript
// packages/matrix-client/src/bridge.ts（追加到 bridgeToStores 函数末尾）

import { bridgePresence } from "./presence";
import { fetchAgentRegistry } from "./agent-registry";

// 在 bridgeToStores 函数的 onSync PREPARED 分支中追加：
if (state === "PREPARED") {
  syncStore.setInitialSyncComplete();
  syncRoomList(client);

  // ⭐ 新增：加载 Agent 注册表
  const controllerUrl = inferControllerUrl(client);
  if (controllerUrl) {
    fetchAgentRegistry(controllerUrl);
  }
}

// 在 bridgeToStores 函数返回 cleanup 之前追加：
const cleanupPresence = bridgePresence(client);

// 在 cleanup 中追加：
// cleanupPresence();

/**
 * 从 homeserver URL 推断 HiClaw Controller URL。
 * 约定：Controller 与 Matrix homeserver 在同一 host，端口 8080。
 * 可通过环境变量 MAGIC_CONTROLLER_URL 覆盖。
 */
function inferControllerUrl(client: MatrixClient): string | null {
  // 优先使用环境变量
  if (typeof window !== "undefined") {
    const envUrl = (window as any).__MAGIC_CONTROLLER_URL__;
    if (envUrl) return envUrl;
  }

  // 从 homeserver URL 推断
  try {
    const baseUrl = client.getHomeserverUrl();
    const url = new URL(baseUrl);
    // HiClaw 约定：Controller API 通过 AI Gateway (Higress) 代理
    // 路径为 /api/v1/*，与 Matrix homeserver 共享域名
    return `${url.protocol}//${url.hostname}:8080`;
  } catch {
    return null;
  }
}
```

### 4.6 agentDetection.ts — 三层回退的统一检测

```typescript
// packages/ui/src/lib/agentDetection.ts
import {
  useAgentRegistryStore,
  useAgentStore,
  usePresenceStore,
} from "@magic/matrix-client";

export type AgentRuntime = "openclaw" | "hermes" | "qwenpaw" | null;
export type AgentRole = "worker" | "manager" | null;

export interface AgentInfo {
  /** 是否为 Agent（Worker 或 Manager） */
  isAgent: boolean;
  /** 运行时类型 */
  runtime: AgentRuntime;
  /** 角色（worker / manager） */
  role: AgentRole;
  /** 在线状态 */
  status: "online" | "idle" | "offline" | "error" | null;
  /** 判断依据 */
  source: "crd-api" | "agent-event" | "name-pattern" | "none";
  /** 标签文字（AGENT / HERMES / QWENPAW / MANAGER） */
  tagLabel: string | null;
  /** 标签背景色 */
  tagBg: string | null;
  /** 标签文字色 */
  tagColor: string | null;
  /** 发送者名称颜色（角色色） */
  nameColor: string;
}

/**
 * 三层回退的 Agent 检测。
 *
 * 第 1 层：CRD API 注册表（100% 准确）
 * 第 2 层：agentStore 中的实时事件（Agent 运行中才有）
 * 第 3 层：用户名模式匹配（降级方案）
 */
export function getAgentInfo(userId: string, roomId?: string): AgentInfo {
  // ---- 第 1 层：CRD API 注册表 ----
  const registry = useAgentRegistryStore.getState();
  const registered = registry.getAgent(userId);

  if (registered) {
    const agentStatus = getAgentOnlineStatus(userId, roomId);
    const runtime = registered.runtime;
    const role = registered.role;
    return {
      isAgent: true,
      runtime,
      role,
      status: agentStatus,
      source: "crd-api",
      ...getTagStyle(runtime, role),
      nameColor: getNameColor(runtime, role),
    };
  }

  // ---- 第 2 层：agentStore 实时事件 ----
  const agentStore = useAgentStore.getState();
  const agentData = Object.values(agentStore.agents).find(
    (a) => a.userId === userId && (!roomId || a.roomId === roomId)
  );

  if (agentData) {
    const runtime = inferRuntimeFromModel(agentData.model);
    return {
      isAgent: true,
      runtime,
      role: "worker",
      status: mapAgentStatus(agentData.status),
      source: "agent-event",
      ...getTagStyle(runtime, "worker"),
      nameColor: getNameColor(runtime, "worker"),
    };
  }

  // ---- 第 3 层：用户名模式匹配（降级）----
  // 仅在 CRD API 不可用时生效
  if (!registry.loaded || registry.error) {
    const inferred = inferFromUserId(userId);
    if (inferred) {
      return {
        isAgent: true,
        ...inferred,
        status: null, // 无法判断在线状态
        source: "name-pattern",
      };
    }
  }

  // ---- 不是 Agent ----
  return {
    isAgent: false,
    runtime: null,
    role: null,
    status: null,
    source: "none",
    tagLabel: null,
    tagBg: null,
    tagColor: null,
    nameColor: "#DBDEE1",
  };
}

/**
 * 获取 Agent 的在线状态。
 * 数据源：agentStore 中的 status 字段 + 心跳超时判断。
 */
function getAgentOnlineStatus(
  userId: string,
  roomId?: string,
): AgentInfo["status"] {
  const agentStore = useAgentStore.getState();
  const agentData = Object.values(agentStore.agents).find(
    (a) => a.userId === userId && (!roomId || a.roomId === roomId)
  );

  if (!agentData) return "offline";

  // 心跳超时判断：60 秒无心跳视为离线
  const HEARTBEAT_TIMEOUT = 60_000;
  if (
    (agentData.status === "active" || agentData.status === "idle") &&
    Date.now() - agentData.lastHeartbeat > HEARTBEAT_TIMEOUT
  ) {
    return "offline";
  }

  return mapAgentStatus(agentData.status);
}

function mapAgentStatus(
  status: "active" | "idle" | "offline" | "error",
): AgentInfo["status"] {
  switch (status) {
    case "active": return "online";
    case "idle": return "idle";
    case "offline": return "offline";
    case "error": return "error";
    default: return "offline";
  }
}

/**
 * 获取真人的在线状态。
 * 数据源：Matrix Presence API（m.presence 事件）。
 */
export function getHumanOnlineStatus(userId: string): "online" | "idle" | "offline" {
  const presenceStore = usePresenceStore.getState();
  const presence = presenceStore.getPresence(userId);

  if (!presence) {
    // Presence 数据不可用（Tuwunel 可能关闭了 Presence）
    // 降级：无法判断，返回 null 让 UI 不显示状态点
    return "offline";
  }

  // 5 分钟无活动视为离线
  const INACTIVE_TIMEOUT = 5 * 60 * 1000;

  switch (presence.presence) {
    case "online":
      if (presence.currentlyActive) return "online";
      if (presence.lastActiveAgo && presence.lastActiveAgo > INACTIVE_TIMEOUT) return "idle";
      return "online";
    case "unavailable":
      return "idle";
    case "offline":
    default:
      return "offline";
  }
}

/**
 * 获取任意用户（Agent 或真人）的在线状态颜色。
 */
export function getStatusColor(userId: string, roomId?: string): string {
  const agentInfo = getAgentInfo(userId, roomId);

  if (agentInfo.isAgent) {
    switch (agentInfo.status) {
      case "online": return "#23A55A";
      case "idle": return "#F0B232";
      case "error": return "#F23F43";
      case "offline": return "#6D6F78";
      default: return "#6D6F78";
    }
  }

  // 真人：使用 Matrix Presence
  const humanStatus = getHumanOnlineStatus(userId);
  switch (humanStatus) {
    case "online": return "#23A55A";
    case "idle": return "#F0B232";
    case "offline": return "#6D6F78";
    default: return "#6D6F78";
  }
}

// ---- 标签样式 ----

function getTagStyle(runtime: AgentRuntime, role: AgentRole): {
  tagLabel: string | null;
  tagBg: string | null;
  tagColor: string | null;
} {
  if (role === "manager") {
    return { tagLabel: "MANAGER", tagBg: "rgba(26,188,156,0.25)", tagColor: "#1ABC9C" };
  }
  switch (runtime) {
    case "openclaw":
      return { tagLabel: "AGENT", tagBg: "rgba(88,101,242,0.25)", tagColor: "#A5B0FC" };
    case "hermes":
      return { tagLabel: "HERMES", tagBg: "rgba(237,66,69,0.25)", tagColor: "#F47B67" };
    case "qwenpaw":
      return { tagLabel: "QWENPAW", tagBg: "rgba(35,165,90,0.25)", tagColor: "#57F287" };
    default:
      return { tagLabel: "AGENT", tagBg: "rgba(88,101,242,0.25)", tagColor: "#A5B0FC" };
  }
}

function getNameColor(runtime: AgentRuntime, role: AgentRole): string {
  if (role === "manager") return "#1ABC9C";
  switch (runtime) {
    case "openclaw": return "#57F287";
    case "hermes": return "#F47B67";
    case "qwenpaw": return "#F0B232";
    default: return "#57F287";
  }
}

function inferRuntimeFromModel(model: string | undefined): AgentRuntime {
  const m = (model ?? "").toLowerCase();
  if (m.includes("hermes")) return "hermes";
  if (m.includes("qwenpaw") || m.includes("copaw")) return "qwenpaw";
  return "openclaw";
}

function inferFromUserId(userId: string): Omit<AgentInfo, "isAgent" | "status" | "source"> | null {
  const name = userId.toLowerCase();
  let runtime: AgentRuntime = null;
  let role: AgentRole = null;

  if (name.includes("hermes")) { runtime = "hermes"; role = "worker"; }
  else if (name.includes("qwenpaw") || name.includes("copaw")) { runtime = "qwenpaw"; role = "worker"; }
  else if (name.includes("manager")) { runtime = "openclaw"; role = "manager"; }
  else if (name.includes("worker") || name.includes("agent")) { runtime = "openclaw"; role = "worker"; }
  else return null;

  return {
    runtime,
    role,
    ...getTagStyle(runtime, role),
    nameColor: getNameColor(runtime, role),
  };
}
```

### 4.7 AgentTag.tsx — 通用运行时标签组件

```tsx
// packages/ui/src/agents/AgentTag.tsx
import { memo } from "react";
import type { AgentInfo } from "../lib/agentDetection";

interface AgentTagProps {
  agentInfo: AgentInfo;
  size?: "sm" | "md";
}

export const AgentTag = memo(function AgentTag({ agentInfo, size = "sm" }: AgentTagProps) {
  if (!agentInfo.isAgent || !agentInfo.tagLabel) return null;

  return (
    <span
      className={`inline-flex items-center rounded-sm font-bold uppercase align-middle
                  ${size === "sm" ? "text-[9px] px-1 py-px ml-1" : "text-[10px] px-1.5 py-0.5"}`}
      style={{
        backgroundColor: agentInfo.tagBg ?? undefined,
        color: agentInfo.tagColor ?? undefined,
      }}
    >
      {agentInfo.tagLabel}
    </span>
  );
});
```

### 4.8 MentionPill.tsx — @mention 渲染

```tsx
// packages/ui/src/mentions/MentionPill.tsx
import { memo } from "react";
import { useAuthStore } from "@magic/matrix-client";

interface MentionPillProps {
  userId: string;
  displayName: string;
}

export const MentionPill = memo(function MentionPill({ userId, displayName }: MentionPillProps) {
  const currentUserId = useAuthStore((s) => s.userId);
  const isMe = userId === currentUserId;

  return (
    <span
      className={`inline cursor-pointer rounded-[3px] px-[2px] font-medium transition-colors
                  ${isMe
                    ? "bg-[rgba(88,101,242,0.35)] text-white hover:bg-[rgba(88,101,242,0.55)]"
                    : "bg-[rgba(88,101,242,0.25)] text-[#C9CDFB] hover:bg-[rgba(88,101,242,0.45)] hover:text-white"
                  }`}
      title={userId}
    >
      @{displayName}
    </span>
  );
});
```

### 4.9 更新 MessageBubble.tsx — 渲染 AgentTag

在 `showSender` 区域的发送者名后追加：

```tsx
import { getAgentInfo } from "../lib/agentDetection";
import { AgentTag } from "../agents/AgentTag";

// 在 MessageBubble 组件内：
const agentInfo = getAgentInfo(event.sender);

// 发送者行：
{showSender && (
  <div className="mb-0.5 flex items-baseline gap-1">
    <span className="text-[13px] font-semibold cursor-pointer hover:underline"
          style={{ color: agentInfo.nameColor }}>
      {senderName}
    </span>
    <AgentTag agentInfo={agentInfo} size="sm" />
    <span className="text-[10.5px] text-[#6D6F78]">{time}</span>
  </div>
)}
```

### 4.10 更新 TextMessage.tsx — 渲染 MentionPill

```tsx
import { MentionPill } from "../mentions/MentionPill";

// 在 ReactMarkdown components.a 中：
a({ href, children }) {
  if (href?.startsWith("https://matrix.to/#/@")) {
    const userId = decodeURIComponent(href.replace("https://matrix.to/#/", ""));
    const displayName = typeof children === "string" ? children
      : Array.isArray(children) ? children.map(c => typeof c === "string" ? c : "").join("")
      : userId.match(/^@([^:]+)/)?.[1] ?? userId;
    return <MentionPill userId={userId} displayName={displayName} />;
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#00A8FC] hover:underline">{children}</a>;
},
```

### 4.11 更新 RoomListItem.tsx — DM 状态圆点

```tsx
import { getStatusColor } from "../lib/agentDetection";

// 私聊项的状态圆点：
{room.isDirect ? (
  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
    <span
      className="h-2 w-2 rounded-full"
      style={{ backgroundColor: getDmUserStatusColor(room) }}
    />
  </span>
) : (
  <span className="w-4 shrink-0 text-center text-base leading-none opacity-60">#</span>
)}

// 辅助函数：
function getDmUserStatusColor(room: RoomData): string {
  // 从 room 获取对方 userId，查询在线状态
  // DM 房间通常只有两个成员，对方就是非自己的那个
  // 这里简化为从房间名推断
  const otherUserId = `@${room.name}:unknown`;
  return getStatusColor(otherUserId, room.roomId);
}
```

### 4.12 更新 MemberPanel.tsx — 统一使用 AgentTag + 状态检测

```tsx
import { getAgentInfo, getStatusColor } from "../lib/agentDetection";
import { AgentTag } from "../agents/AgentTag";

function MemberItem({ member }: { member: RoomMember }) {
  const agentInfo = getAgentInfo(member.userId);
  const statusColorHex = getStatusColor(member.userId);

  return (
    <div className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#35373C]">
      <div className="relative shrink-0">
        <RoomAvatar name={member.displayName} avatarMxc={member.avatarMxc} isDirect size={28} />
        <div className="absolute -bottom-px -right-px flex h-[10px] w-[10px] items-center
                        justify-center rounded-full bg-[#2B2D31]">
          <div className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: statusColorHex }} />
        </div>
      </div>
      <span className="flex-1 truncate text-[12.5px] text-[#949BA4]">{member.displayName}</span>
      <AgentTag agentInfo={agentInfo} size="md" />
    </div>
  );
}
```

### 4.13 更新 useRoomMembers.ts — 使用 agentDetection

```typescript
import { getAgentInfo, getHumanOnlineStatus } from "../lib/agentDetection";

// 在 map 中：
return members
  .filter((m) => m.userId !== currentUserId)
  .map((member): RoomMember => {
    const agentInfo = getAgentInfo(member.userId, roomId ?? undefined);

    return {
      userId: member.userId,
      displayName: member.name || extractName(member.userId),
      avatarMxc: member.getMxcAvatarUrl() ?? null,
      isAgent: agentInfo.isAgent,
      agentStatus: agentInfo.isAgent ? agentInfo.status ?? undefined : undefined,
      agentRuntime: agentInfo.runtime ?? undefined,
      powerLevel: room.getMemberPowerLevel(member.userId),
    };
  });
```

---

## 5. 更新 @magic/matrix-client 和 @magic/ui 导出

**matrix-client/src/index.ts** 追加：
```typescript
export { useAgentRegistryStore } from "./stores/agentRegistryStore";
export type { RegisteredAgent } from "./stores/agentRegistryStore";
export { usePresenceStore } from "./stores/presenceStore";
export type { PresenceState } from "./stores/presenceStore";
export { fetchAgentRegistry } from "./agent-registry";
export { bridgePresence } from "./presence";
```

**ui/src/index.ts** 追加：
```typescript
export { getAgentInfo, getHumanOnlineStatus, getStatusColor } from "./lib/agentDetection";
export type { AgentInfo, AgentRuntime, AgentRole } from "./lib/agentDetection";
export { AgentTag } from "./agents/AgentTag";
```

---

## 6. 验收标准

| # | 检查项 | 对应红框 | 验证方式 |
|---|--------|---------|---------|
| AC-1 | 私聊 DM 状态圆点反映真实 Agent 在线状态（绿=活跃，黄=空闲，灰=离线） | 红框 1 | 停止一个 Worker，观察圆点变灰 |
| AC-2 | 消息中 `@worker-alice` 渲染为蓝色 mention pill | 红框 2 | 发送含 @mention 的消息 |
| AC-3 | OpenClaw Agent 发送者名旁显示 `AGENT` 标签 | 红框 3 | 视觉检查 |
| AC-4 | Hermes Agent 发送者名旁显示 `HERMES` 标签 | 红框 4 | 视觉检查 |
| AC-5 | 成员面板 "在线 — N" 分组正确统计 | 红框 5 | 视觉检查 |
| AC-6 | 成员面板 Agent 旁显示运行时标签 | 红框 6+7 | 视觉检查 |
| AC-7 | 成员面板 "离线 — N" 分组正确统计 | 红框 8 | 视觉检查 |
| AC-8 | Agent 判断基于 CRD API（不是用户名猜测） | — | 检查 agentRegistryStore.loaded === true |
| AC-9 | CRD API 不可用时降级到用户名模式匹配，不报错 | — | 断开 Controller，检查 UI 仍能显示标签 |
| AC-10 | 真人在线状态基于 Matrix Presence（如果 Tuwunel 支持） | — | 另一真人下线后观察圆点变化 |
| AC-11 | `pnpm typecheck && pnpm build` 通过 | — | 命令验证 |

---

## 7. 实现任务（按执行顺序）

### 任务 1：创建 agentRegistryStore + presenceStore

**创建文件**：
- `packages/matrix-client/src/stores/agentRegistryStore.ts`
- `packages/matrix-client/src/stores/presenceStore.ts`

**修改文件**：
- `packages/matrix-client/src/stores/index.ts`（追加导出）
- `packages/matrix-client/src/index.ts`（追加导出）

**验证**：`pnpm typecheck`

---

### 任务 2：创建 agent-registry.ts 和 presence.ts

**创建文件**：
- `packages/matrix-client/src/agent-registry.ts`
- `packages/matrix-client/src/presence.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：更新 bridge.ts — 追加 Presence 监听和 Agent Registry 加载

**修改文件**：`packages/matrix-client/src/bridge.ts`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 agentDetection.ts

**创建文件**：`packages/ui/src/lib/agentDetection.ts`

**验证**：`pnpm typecheck`

---

### 任务 5：创建 AgentTag 组件

**创建文件**：`packages/ui/src/agents/AgentTag.tsx`

**验证**：`pnpm typecheck`

---

### 任务 6：确认/更新 MentionPill 组件

**修改文件**：`packages/ui/src/mentions/MentionPill.tsx`

**验证**：`pnpm typecheck`

---

### 任务 7：更新 MessageBubble — 渲染 AgentTag

**修改文件**：`packages/ui/src/chat/MessageBubble.tsx`

**验证**：`pnpm typecheck`

---

### 任务 8：更新 TextMessage — 渲染 MentionPill

**修改文件**：`packages/ui/src/chat/TextMessage.tsx`

**验证**：`pnpm typecheck`

---

### 任务 9：更新 RoomListItem + MemberPanel + useRoomMembers

**修改文件**：
- `packages/ui/src/rooms/RoomListItem.tsx`（DM 状态圆点）
- `packages/ui/src/panels/MemberPanel.tsx`（AgentTag + getStatusColor）
- `packages/ui/src/hooks/useRoomMembers.ts`（agentDetection 集成）

**验证**：`pnpm typecheck`

---

### 任务 10：更新导出

**修改文件**：
- `packages/matrix-client/src/index.ts`
- `packages/ui/src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 11：编写单元测试

**创建文件**：
- `packages/matrix-client/__tests__/stores/agentRegistryStore.test.ts` — isAgent、getAgent
- `packages/ui/__tests__/lib/agentDetection.test.ts` — 三层回退逻辑
- `packages/ui/__tests__/agents/AgentTag.test.tsx` — 各运行时标签渲染
- `packages/ui/__tests__/mentions/MentionPill.test.tsx` — 自己/他人样式

**验证**：`pnpm test`

---

### 任务 12：全局集成验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 验证截图中全部 8 个红框功能点
```

完成后提交：
```bash
git add -A
git commit -m "feat: 014 - agent tags, mention pills, CRD-based detection, matrix presence"
```

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| HiClaw Controller API 不可达 | 无法获取 Agent 注册表 | 三层回退：CRD API → agentStore 事件 → 用户名模式匹配 |
| CRD API 返回格式与预期不符 | 解析失败 | try-catch + 宽松解析（`workersData.items ?? workersData`） |
| Tuwunel 关闭了 Presence | 真人在线状态全部显示离线 | 降级提示 + 后续建议在 Tuwunel 配置中开启 `presence.enabled` |
| Agent userId 格式不统一 | CRD API 返回的 userId 与实际不匹配 | 优先使用 `status.matrixUserId`，回退到 `@worker-{name}:{domain}` 推断 |
| DM 房间获取对方 userId | 房间名不一定等于 userId | 应通过 `room.getJoinedMembers()` 获取非自己的成员，而不是从房间名推断 |