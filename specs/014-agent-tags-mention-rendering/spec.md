# Spec 014: Agent 标识与提及渲染（Agent Tags & Mention Rendering）

> 优先级: P0 | 波次: Wave 4 | 预估: 2-3 天 | 前置依赖: 010-agent-status-dashboard, 012-mentions, 013-ui-restructure
> 文件路径: `specs/014-agent-tags-mention-rendering/spec.md`

---

## 1. 目标

实现截图中红框标注的全部 8 个功能点，横跨房间列表、消息时间线、成员面板三个区域。

### 8 个功能点

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

## 2. 关键设计决策

### 2.1 如何判断在线状态——统一使用 Matrix Presence

**核心发现：Agent 也是 Matrix 用户，Tuwunel 默认启用 Presence。**

Agent 的运行时（OpenClaw / Hermes / QwenPaw）后台都有 Matrix 客户端在做 `/sync`。只要 Agent 容器在运行，Tuwunel 自动把它标记为 `online`。容器被 `hiclaw worker sleep` 停止后，sync 中断，Tuwunel 自动标记为 `offline`。

**因此，真人和 Agent 都用同一个机制判断在线：**

```typescript
const user = client.getUser(userId);
user.presence;         // "online" | "unavailable" | "offline" | "busy"
user.currentlyActive;  // boolean — 此刻是否活跃
user.lastActiveAgo;    // 毫秒 — 距上次活跃多久
```

这是 matrix-js-sdk 内置的 `User` 对象，数据来自 `/sync` 响应中的 `m.presence` 事件，客户端**不需要额外轮询**。

**不需要自建 presenceStore**——matrix-js-sdk 已经维护了每个用户的 presence 状态。

| 场景 | 服务端行为 | 客户端看到的 |
|------|----------|-------------|
| 用户打开客户端 | sync 开始 → 自动标记 online | `user.presence = "online"` |
| 用户 5 分钟无操作 | 自动标记 unavailable | `user.presence = "unavailable"` |
| 用户关闭客户端 | sync 中断 → 标记 offline | `user.presence = "offline"` |
| Agent 容器运行中 | Agent 的 Matrix 客户端在 sync | `user.presence = "online"` |
| `hiclaw worker sleep` | 容器停止 → sync 中断 | `user.presence = "offline"` |

### 2.2 如何判断 Agent vs 真人

Matrix 协议不区分 Agent 和真人，需要外部数据。三层回退：

| 优先级 | 方法 | 准确度 |
|--------|------|--------|
| 第 1 层 | HiClaw CRD API（`/api/v1/workers` + `/api/v1/managers`） | 100% |
| 第 2 层 | `agentStore` 中收到过 `com.magic.agent.status` 事件的 userId | 高 |
| 第 3 层 | 用户名模式匹配（仅当 CRD API 不可用时降级） | 低 |

### 2.3 HiClaw 自定义事件的定位

`com.magic.agent.status` / `com.magic.heartbeat` 不是用来判断在线的——在线交给 Matrix Presence。它们的价值是传递**业务状态**：

- Agent 正在执行什么任务（`current_task_id`）
- Agent 的能力列表（`capabilities`）
- Agent 使用的模型（`model`）
- Agent 的运行时类型（通过 `model` 字段推断或 CRD API 获取）

---

## 3. 文件结构

```
packages/
├── matrix-client/src/
│   ├── stores/
│   │   └── agentRegistryStore.ts    # 新增：从 CRD API 获取的 Agent 注册表
│   └── agent-registry.ts           # 新增：HiClaw CRD API 调用
│
├── ui/src/
│   ├── lib/
│   │   └── agentDetection.ts        # 新增：Agent 识别 + 运行时推断
│   │   └── presenceUtils.ts         # 新增：Matrix Presence → 状态颜色映射
│   ├── agents/
│   │   └── AgentTag.tsx             # 新增：通用运行时标签组件
│   ├── mentions/
│   │   └── MentionPill.tsx          # 更新：样式确认
│   ├── chat/
│   │   ├── MessageBubble.tsx        # 更新：渲染 AgentTag
│   │   └── TextMessage.tsx          # 更新：渲染 MentionPill
│   ├── rooms/
│   │   └── RoomListItem.tsx         # 更新：DM 状态圆点用 Matrix Presence
│   ├── panels/
│   │   └── MemberPanel.tsx          # 更新：用 Matrix Presence 分组 + AgentTag
│   └── hooks/
│       └── useRoomMembers.ts        # 更新：增强 Agent 识别 + presence
```

---

## 4. 技术规格

### 4.1 agentRegistryStore.ts — Agent 注册表

```typescript
// packages/matrix-client/src/stores/agentRegistryStore.ts
import { create } from "zustand";

export interface RegisteredAgent {
  userId: string;
  name: string;
  runtime: "openclaw" | "hermes" | "qwenpaw";
  model?: string;
  role: "worker" | "manager";
}

interface AgentRegistryState {
  agents: Record<string, RegisteredAgent>;
  loaded: boolean;
  error: string | null;

  setAgents: (agents: RegisteredAgent[]) => void;
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
    for (const a of agents) map[a.userId] = a;
    set({ agents: map, loaded: true, error: null });
  },
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
 * 登录并同步完成后调用一次。
 * 从 HiClaw Controller 获取全量 Agent 列表。
 */
export async function fetchAgentRegistry(controllerUrl: string): Promise<void> {
  const store = useAgentRegistryStore.getState();

  try {
    const agents: RegisteredAgent[] = [];

    // Workers
    const workersRes = await fetch(`${controllerUrl}/api/v1/workers`);
    if (workersRes.ok) {
      const data = await workersRes.json();
      const workers = Array.isArray(data) ? data : data.items ?? [];
      for (const w of workers) {
        const name = w.metadata?.name ?? w.name ?? "";
        const spec = w.spec ?? {};
        agents.push({
          userId: w.status?.matrixUserId ?? `@worker-${name}:${getDomain(controllerUrl)}`,
          name,
          runtime: normalizeRuntime(spec.runtime),
          model: spec.model,
          role: "worker",
        });
      }
    }

    // Managers
    const managerRes = await fetch(`${controllerUrl}/api/v1/managers`);
    if (managerRes.ok) {
      const data = await managerRes.json();
      const managers = Array.isArray(data) ? data : [data];
      for (const m of managers) {
        agents.push({
          userId: m.status?.matrixUserId ?? `@${m.metadata?.name ?? "manager"}:${getDomain(controllerUrl)}`,
          name: m.metadata?.name ?? "manager",
          runtime: normalizeRuntime(m.spec?.runtime ?? "openclaw"),
          model: m.spec?.model,
          role: "manager",
        });
      }
    }

    store.setAgents(agents);
  } catch (err: any) {
    console.warn("HiClaw CRD API 不可用，回退到事件检测:", err.message);
    store.setError(err.message);
  }
}

function normalizeRuntime(raw: string | undefined): RegisteredAgent["runtime"] {
  const r = (raw ?? "").toLowerCase();
  if (r.includes("hermes")) return "hermes";
  if (r.includes("copaw") || r.includes("qwenpaw")) return "qwenpaw";
  return "openclaw";
}

function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return "magic.com"; }
}
```

### 4.3 presenceUtils.ts — Matrix Presence → 颜色/状态映射

```typescript
// packages/ui/src/lib/presenceUtils.ts
import { getClient } from "@magic/matrix-client";

export type OnlineStatus = "online" | "idle" | "offline";

/**
 * 获取任意 Matrix 用户的在线状态——直接读 matrix-js-sdk 的 User 对象。
 * 无需自建 store，SDK 已经通过 /sync 维护了 presence 数据。
 */
export function getUserPresence(userId: string): OnlineStatus {
  try {
    const client = getClient();
    const user = client.getUser(userId);
    if (!user) return "offline";

    switch (user.presence) {
      case "online":
        return "online";
      case "unavailable":
        return "idle";
      case "offline":
        return "offline";
      case "busy":
        return "online"; // busy 视为在线
      default:
        return "offline";
    }
  } catch {
    return "offline";
  }
}

/**
 * 在线状态 → 颜色。
 */
export function getPresenceColor(status: OnlineStatus): string {
  switch (status) {
    case "online": return "#23A55A";
    case "idle": return "#F0B232";
    case "offline": return "#6D6F78";
  }
}

/**
 * 在线状态 → 中文标签。
 */
export function getPresenceLabel(status: OnlineStatus): string {
  switch (status) {
    case "online": return "在线";
    case "idle": return "空闲";
    case "offline": return "离线";
  }
}
```

### 4.4 agentDetection.ts — Agent 识别（不负责在线状态）

```typescript
// packages/ui/src/lib/agentDetection.ts
import { useAgentRegistryStore, useAgentStore } from "@magic/matrix-client";

export type AgentRuntime = "openclaw" | "hermes" | "qwenpaw" | null;
export type AgentRole = "worker" | "manager" | null;

export interface AgentInfo {
  isAgent: boolean;
  runtime: AgentRuntime;
  role: AgentRole;
  source: "crd-api" | "agent-event" | "name-pattern" | "none";
  tagLabel: string | null;
  tagBg: string | null;
  tagColor: string | null;
  nameColor: string;
}

/**
 * 判断一个 userId 是不是 Agent，以及它的运行时类型。
 * 三层回退。不负责在线状态（在线状态统一用 presenceUtils.getUserPresence）。
 */
export function getAgentInfo(userId: string, roomId?: string): AgentInfo {
  // 第 1 层：CRD API 注册表
  const registry = useAgentRegistryStore.getState();
  const registered = registry.getAgent(userId);
  if (registered) {
    return {
      isAgent: true,
      runtime: registered.runtime,
      role: registered.role,
      source: "crd-api",
      ...getTagStyle(registered.runtime, registered.role),
      nameColor: getNameColor(registered.runtime, registered.role),
    };
  }

  // 第 2 层：agentStore 实时事件
  const agentData = Object.values(useAgentStore.getState().agents).find(
    (a) => a.userId === userId && (!roomId || a.roomId === roomId)
  );
  if (agentData) {
    const runtime = inferRuntimeFromModel(agentData.model);
    return {
      isAgent: true, runtime, role: "worker", source: "agent-event",
      ...getTagStyle(runtime, "worker"),
      nameColor: getNameColor(runtime, "worker"),
    };
  }

  // 第 3 层：用户名模式匹配（仅当 CRD API 不可用时）
  if (!registry.loaded || registry.error) {
    const inferred = inferFromUserId(userId);
    if (inferred) return { isAgent: true, source: "name-pattern", ...inferred };
  }

  return {
    isAgent: false, runtime: null, role: null, source: "none",
    tagLabel: null, tagBg: null, tagColor: null, nameColor: "#DBDEE1",
  };
}

function getTagStyle(runtime: AgentRuntime, role: AgentRole) {
  if (role === "manager") return { tagLabel: "MANAGER", tagBg: "rgba(26,188,156,0.25)", tagColor: "#1ABC9C" };
  switch (runtime) {
    case "hermes": return { tagLabel: "HERMES", tagBg: "rgba(237,66,69,0.25)", tagColor: "#F47B67" };
    case "qwenpaw": return { tagLabel: "QWENPAW", tagBg: "rgba(35,165,90,0.25)", tagColor: "#57F287" };
    default: return { tagLabel: "AGENT", tagBg: "rgba(88,101,242,0.25)", tagColor: "#A5B0FC" };
  }
}

function getNameColor(runtime: AgentRuntime, role: AgentRole): string {
  if (role === "manager") return "#1ABC9C";
  switch (runtime) {
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

function inferFromUserId(userId: string): Omit<AgentInfo, "isAgent" | "source"> | null {
  const n = userId.toLowerCase();
  if (n.includes("hermes")) return { runtime: "hermes", role: "worker", ...getTagStyle("hermes", "worker"), nameColor: "#F47B67" };
  if (n.includes("qwenpaw") || n.includes("copaw")) return { runtime: "qwenpaw", role: "worker", ...getTagStyle("qwenpaw", "worker"), nameColor: "#F0B232" };
  if (n.includes("manager")) return { runtime: "openclaw", role: "manager", ...getTagStyle("openclaw", "manager"), nameColor: "#1ABC9C" };
  if (n.includes("worker") || n.includes("agent")) return { runtime: "openclaw", role: "worker", ...getTagStyle("openclaw", "worker"), nameColor: "#57F287" };
  return null;
}
```

### 4.5 AgentTag.tsx — 通用运行时标签

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
      style={{ backgroundColor: agentInfo.tagBg ?? undefined, color: agentInfo.tagColor ?? undefined }}
    >
      {agentInfo.tagLabel}
    </span>
  );
});
```

### 4.6 MentionPill.tsx

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

### 4.7 更新 MessageBubble.tsx — AgentTag + 角色色

在发送者名后面追加 `<AgentTag>`，用 `agentInfo.nameColor` 替代旧的 `getRoleColor()`：

```tsx
import { getAgentInfo } from "../lib/agentDetection";
import { AgentTag } from "../agents/AgentTag";

// 在 MessageBubble 组件内：
const agentInfo = getAgentInfo(event.sender);

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

// ⚠️ 删除旧的 getRoleColor() 函数
```

### 4.8 更新 TextMessage.tsx — 渲染 MentionPill

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

### 4.9 更新 RoomListItem.tsx — DM 状态圆点用 Matrix Presence

```tsx
import { getUserPresence, getPresenceColor } from "../lib/presenceUtils";
import { getClient } from "@magic/matrix-client";

// 在 RoomListItem 中，私聊项的状态圆点：
{room.isDirect ? (
  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
    <span
      className="h-2 w-2 rounded-full"
      style={{ backgroundColor: getDmPresenceColor(room.roomId) }}
    />
  </span>
) : (
  <span className="w-4 shrink-0 text-center text-base leading-none opacity-60">#</span>
)}

/**
 * 获取 DM 对方的在线状态颜色。
 * 通过 room.getJoinedMembers() 找到对方（非自己的成员），
 * 再读 matrix-js-sdk 的 User.presence。
 */
function getDmPresenceColor(roomId: string): string {
  try {
    const client = getClient();
    const room = client.getRoom(roomId);
    if (!room) return "#6D6F78";

    const myUserId = client.getUserId();
    const members = room.getJoinedMembers();
    const other = members.find((m) => m.userId !== myUserId);
    if (!other) return "#6D6F78";

    const status = getUserPresence(other.userId);
    return getPresenceColor(status);
  } catch {
    return "#6D6F78";
  }
}
```

### 4.10 更新 MemberPanel.tsx — Matrix Presence 分组 + AgentTag

```tsx
import { getUserPresence, getPresenceColor } from "../lib/presenceUtils";
import { getAgentInfo } from "../lib/agentDetection";
import { AgentTag } from "../agents/AgentTag";

export function MemberPanel({ roomId }: MemberPanelProps) {
  const members = useRoomMembers(roomId);

  // ⭐ 用 Matrix Presence 分组，不是 agentStatus
  const online = members.filter((m) => {
    const status = getUserPresence(m.userId);
    return status === "online" || status === "idle";
  });
  const offline = members.filter((m) => {
    const status = getUserPresence(m.userId);
    return status === "offline";
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {online.length > 0 && <MemberSection label={`在线 — ${online.length}`} members={online} />}
      {offline.length > 0 && <MemberSection label={`离线 — ${offline.length}`} members={offline} />}
    </div>
  );
}

function MemberItem({ member }: { member: RoomMember }) {
  const agentInfo = getAgentInfo(member.userId);
  const presenceStatus = getUserPresence(member.userId);
  const statusColor = getPresenceColor(presenceStatus);

  return (
    <div className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#35373C]">
      <div className="relative shrink-0">
        <RoomAvatar name={member.displayName} avatarMxc={member.avatarMxc} isDirect size={28} />
        <div className="absolute -bottom-px -right-px flex h-[10px] w-[10px] items-center
                        justify-center rounded-full bg-[#2B2D31]">
          <div className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: statusColor }} />
        </div>
      </div>
      <span className="flex-1 truncate text-[12.5px] text-[#949BA4]">{member.displayName}</span>
      <AgentTag agentInfo={agentInfo} size="md" />
    </div>
  );
}
```

### 4.11 更新 useRoomMembers.ts

```typescript
import { getAgentInfo } from "../lib/agentDetection";

// 在 map 中用 getAgentInfo 替代原有的 agentUserIds 判断：
return members
  .filter((m) => m.userId !== currentUserId)
  .map((member): RoomMember => {
    const agentInfo = getAgentInfo(member.userId, roomId ?? undefined);
    return {
      userId: member.userId,
      displayName: member.name || extractName(member.userId),
      avatarMxc: member.getMxcAvatarUrl() ?? null,
      isAgent: agentInfo.isAgent,
      agentStatus: undefined,  // 不再需要——用 getUserPresence() 代替
      agentRuntime: agentInfo.runtime ?? undefined,
      powerLevel: room.getMemberPowerLevel(member.userId),
    };
  });
```

### 4.12 更新 bridge.ts — 初始同步后加载 Agent 注册表

```typescript
// 在 bridgeToStores 函数的 onSync PREPARED 分支中追加：
import { fetchAgentRegistry } from "./agent-registry";

if (state === "PREPARED") {
  syncStore.setInitialSyncComplete();
  syncRoomList(client);

  // ⭐ 加载 Agent 注册表
  const controllerUrl = getControllerUrl(client);
  if (controllerUrl) {
    fetchAgentRegistry(controllerUrl);
  }
}

function getControllerUrl(client: MatrixClient): string | null {
  if (typeof window !== "undefined" && (window as any).__MAGIC_CONTROLLER_URL__) {
    return (window as any).__MAGIC_CONTROLLER_URL__;
  }
  try {
    const url = new URL(client.getHomeserverUrl());
    return `${url.protocol}//${url.hostname}:8080`;
  } catch {
    return null;
  }
}
```

---

## 5. 更新导出

**matrix-client/src/index.ts** 追加：
```typescript
export { useAgentRegistryStore } from "./stores/agentRegistryStore";
export type { RegisteredAgent } from "./stores/agentRegistryStore";
export { fetchAgentRegistry } from "./agent-registry";
```

**ui/src/index.ts** 追加：
```typescript
export { getAgentInfo } from "./lib/agentDetection";
export type { AgentInfo, AgentRuntime, AgentRole } from "./lib/agentDetection";
export { getUserPresence, getPresenceColor, getPresenceLabel } from "./lib/presenceUtils";
export type { OnlineStatus } from "./lib/presenceUtils";
export { AgentTag } from "./agents/AgentTag";
```

---

## 6. 验收标准

| # | 检查项 | 对应红框 | 验证方式 |
|---|--------|---------|---------|
| AC-1 | 私聊 DM 状态圆点反映真实在线状态（绿=在线，黄=空闲，灰=离线） | 红框 1 | 停止 Agent 容器，观察圆点从绿变灰 |
| AC-2 | 真人关闭客户端后，DM 状态圆点也变灰 | 红框 1 | 另一真人下线后观察 |
| AC-3 | 消息中 `@worker-alice` 渲染为蓝色 pill | 红框 2 | 发送 @mention 消息 |
| AC-4 | OpenClaw Agent 名旁显示 `AGENT` 标签 | 红框 3 | 视觉检查 |
| AC-5 | Hermes Agent 名旁显示 `HERMES` 标签 | 红框 4 | 视觉检查 |
| AC-6 | 成员面板 "在线 — N" 基于 Matrix Presence 正确统计 | 红框 5 | 视觉检查 |
| AC-7 | 成员面板 Agent 旁有运行时标签 | 红框 6+7 | 视觉检查 |
| AC-8 | 成员面板 "离线 — N" 正确统计 | 红框 8 | 视觉检查 |
| AC-9 | Agent 判断基于 CRD API（不是用户名猜测） | — | 检查 agentRegistryStore.loaded |
| AC-10 | CRD API 不可用时降级到用户名匹配，不报错 | — | 断开 Controller，检查 UI |
| AC-11 | `pnpm typecheck && pnpm build` 通过 | — | 命令验证 |

---

## 7. 实现任务（按执行顺序）

### 任务 1：创建 agentRegistryStore + agent-registry.ts

**创建文件**：
- `packages/matrix-client/src/stores/agentRegistryStore.ts`
- `packages/matrix-client/src/agent-registry.ts`

**修改文件**：
- `packages/matrix-client/src/stores/index.ts`
- `packages/matrix-client/src/index.ts`

**验证**：`pnpm typecheck`

---

### 任务 2：更新 bridge.ts — 同步完成后加载 Agent 注册表

**修改文件**：`packages/matrix-client/src/bridge.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：创建 presenceUtils.ts

**创建文件**：`packages/ui/src/lib/presenceUtils.ts`

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

### 任务 6：确认/更新 MentionPill

**修改文件**：`packages/ui/src/mentions/MentionPill.tsx`

**验证**：`pnpm typecheck`

---

### 任务 7：更新 MessageBubble — 渲染 AgentTag

**修改文件**：`packages/ui/src/chat/MessageBubble.tsx`

**关键变更**：
- import `getAgentInfo` + `AgentTag`
- 发送者名后追加 `<AgentTag>`
- 名称颜色用 `agentInfo.nameColor`
- 删除旧的 `getRoleColor()` 函数

**验证**：`pnpm typecheck`

---

### 任务 8：更新 TextMessage — 渲染 MentionPill

**修改文件**：`packages/ui/src/chat/TextMessage.tsx`

**验证**：`pnpm typecheck`

---

### 任务 9：更新 RoomListItem + MemberPanel + useRoomMembers

**修改文件**：
- `packages/ui/src/rooms/RoomListItem.tsx`（DM 状态圆点用 `getUserPresence`）
- `packages/ui/src/panels/MemberPanel.tsx`（分组用 `getUserPresence` + `AgentTag`）
- `packages/ui/src/hooks/useRoomMembers.ts`（`getAgentInfo` 替代旧逻辑）

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
- `packages/matrix-client/__tests__/stores/agentRegistryStore.test.ts`
- `packages/ui/__tests__/lib/agentDetection.test.ts`
- `packages/ui/__tests__/lib/presenceUtils.test.ts`
- `packages/ui/__tests__/agents/AgentTag.test.tsx`
- `packages/ui/__tests__/mentions/MentionPill.test.tsx`

**验证**：`pnpm test`

---

### 任务 12：全局集成验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 验证全部 8 个红框功能点
```

完成后提交：
```bash
git add -A
git commit -m "feat: 014 - agent tags, mention pills, matrix presence for online status"
```

---

## 8. 与之前方案的对比

| 维度 | 之前的方案 | 本方案 |
|------|----------|--------|
| 真人在线状态 | 自建 `presenceStore` + 监听 `m.presence` 事件 | **直接用 `client.getUser(userId).presence`**——SDK 已维护 |
| Agent 在线状态 | 自定义心跳事件 + 60 秒超时判定 | **同上——Agent 也是 Matrix 用户，Tuwunel 自动跟踪** |
| 新增 Store | 2 个（presenceStore + agentRegistryStore） | **1 个**（仅 agentRegistryStore） |
| 新增文件 | 4 个（presenceStore, presence.ts, agentRegistryStore, agent-registry.ts） | **3 个**（agentRegistryStore, agent-registry.ts, presenceUtils.ts） |
| HiClaw 自定义事件用途 | 判断在线 + 业务状态 | **仅业务状态**（capabilities、model、current_task） |
| 复杂度 | 高——两套独立的在线检测机制 | **低——统一用 Matrix Presence** |