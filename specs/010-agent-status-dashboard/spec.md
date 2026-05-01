# Spec 010: Agent 状态仪表盘（Agent Status Dashboard）

> 优先级: P1 | 波次: Wave 3 | 预估: 3-4 天 | 前置依赖: 002-matrix-sdk-wrapper, 005-room-list-sidebar, 006-chat-timeline

---

## 1. 目标

实现 Magic 平台的 Agent 协同管控面板——实时展示当前房间内所有 Agent 的在线状态、正在执行的任务、能力标签，以及任务看板视图和 Agent 协作关系图。完成后，用户（Manager）可以在右侧面板中一目了然地监控所有 Worker Agent 的工作状态，查看任务分配和进度，并通过可视化图表理解 Agent 之间的协作关系。

### 用户故事

- 作为 Manager，我希望在右侧面板看到当前房间内所有 Agent 的状态卡片（在线/空闲/离线/出错）
- 作为 Manager，我希望看到每个 Agent 正在执行的任务名称和进度
- 作为 Manager，我希望看到一个任务看板，按状态分列（待处理/进行中/已完成/失败）展示所有任务
- 作为 Manager，我希望看到 Agent 之间的协作关系图（力导向图），直观理解团队协作结构
- 作为 Manager，我希望 Agent 状态实时更新，新 Agent 加入或状态变化时自动刷新
- 作为用户，我希望在房间列表的 Agent 房间上看到 Agent 数量和活跃状态的小标识

### 非目标（本 spec 不实现）

- Agent 创建/删除/配置 —— 由 HiClaw Console 管理
- SOUL.md / MEMORY.md 编辑 —— 011-soul-memory-editor
- Agent 性能指标历史趋势图 —— 后续 spec
- 任务的创建/编辑/删除操作 —— 后续 spec（本 spec 仅展示）

---

## 2. 架构设计

### 2.1 数据源

Agent 状态和任务分配通过 Magic 自定义 Matrix 事件传递，已在 002 中定义：

| 事件类型 | 用途 | 存储方式 |
|---------|------|---------|
| `com.magic.agent.status` | Agent 在线状态 + 能力 + 当前任务 | State Event（per agent_id） |
| `com.magic.task.assignment` | 任务详情 + 分配 + 状态 | State Event（per task_id） |
| `com.magic.heartbeat` | Agent 心跳（判断是否真正在线） | Timeline Event |

### 2.2 数据流

```
matrix-js-sdk (State Events)
      ↓ bridge.ts 监听自定义事件
useAgentStore (新增 Zustand store)
      ↓ React 订阅
AgentDashboard → AgentStatusGrid / TaskBoard / CollaborationGraph
```

### 2.3 组件结构

```
packages/
├── matrix-client/src/
│   └── stores/
│       └── agentStore.ts              # 新增：Agent 状态 store
│
├── ui/src/
│   ├── agents/
│   │   ├── AgentDashboard.tsx         # 仪表盘容器（标签切换）
│   │   ├── AgentStatusGrid.tsx        # Agent 状态卡片网格
│   │   ├── AgentStatusCard.tsx        # 单个 Agent 状态卡片
│   │   ├── AgentStatusDot.tsx         # 状态指示点（绿/黄/灰/红）
│   │   ├── TaskBoard.tsx             # 任务看板（四列）
│   │   ├── TaskCard.tsx              # 单个任务卡片
│   │   ├── CollaborationGraph.tsx    # ECharts 力导向协作图
│   │   └── AgentRoomBadge.tsx        # 房间列表上的 Agent 标识
│   ├── hooks/
│   │   ├── useAgentStatus.ts          # Agent 状态数据 hook
│   │   └── useTaskBoard.ts            # 任务看板数据 hook
│   └── layouts/
│       └── MainLayout.tsx             # 更新：接入右侧面板
```

---

## 3. 技术规格

### 3.1 依赖安装

在 `packages/ui/` 中：
```bash
pnpm add echarts@^5.6.0 echarts-for-react@^3.0.0
```

### 3.2 agentStore.ts — Agent 状态 Store

```typescript
// packages/matrix-client/src/stores/agentStore.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { AgentStatusEvent, TaskAssignmentEvent } from "@magic/shared-types";

export interface AgentData {
  agentId: string;
  userId: string;         // Matrix user ID
  status: AgentStatusEvent["status"];
  capabilities: string[];
  model?: string;
  currentTaskId: string | null;
  lastHeartbeat: number;
  roomId: string;
}

export interface TaskData {
  taskId: string;
  title: string;
  assignee: string;
  priority: TaskAssignmentEvent["priority"];
  status: TaskAssignmentEvent["status"];
  dueDate?: string;
  description?: string;
  roomId: string;
}

interface AgentStoreState {
  /** agentId → AgentData */
  agents: Record<string, AgentData>;
  /** taskId → TaskData */
  tasks: Record<string, TaskData>;

  upsertAgent: (roomId: string, event: AgentStatusEvent, sender: string) => void;
  upsertTask: (roomId: string, event: TaskAssignmentEvent) => void;
  updateHeartbeat: (agentId: string, timestamp: number) => void;
  removeAgentsInRoom: (roomId: string) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentStoreState>()(
  immer((set) => ({
    agents: {},
    tasks: {},

    upsertAgent: (roomId, event, sender) => set((s) => {
      s.agents[event.agent_id] = {
        agentId: event.agent_id,
        userId: sender,
        status: event.status,
        capabilities: event.capabilities,
        model: event.model,
        currentTaskId: event.current_task_id,
        lastHeartbeat: event.timestamp,
        roomId,
      };
    }),

    upsertTask: (roomId, event) => set((s) => {
      s.tasks[event.task_id] = {
        taskId: event.task_id,
        title: event.title,
        assignee: event.assignee,
        priority: event.priority,
        status: event.status,
        dueDate: event.due_date,
        description: event.description,
        roomId,
      };
    }),

    updateHeartbeat: (agentId, timestamp) => set((s) => {
      if (s.agents[agentId]) {
        s.agents[agentId].lastHeartbeat = timestamp;
      }
    }),

    removeAgentsInRoom: (roomId) => set((s) => {
      for (const [id, agent] of Object.entries(s.agents)) {
        if (agent.roomId === roomId) delete s.agents[id];
      }
      for (const [id, task] of Object.entries(s.tasks)) {
        if (task.roomId === roomId) delete s.tasks[id];
      }
    }),

    reset: () => set({ agents: {}, tasks: {} }),
  }))
);
```

### 3.3 更新 bridge.ts — 监听自定义事件

在 002 的 `bridge.ts` 的 `bridgeToStores` 函数中追加：

```typescript
// packages/matrix-client/src/bridge.ts（追加到 bridgeToStores 函数内）
import { useAgentStore } from "./stores/agentStore";
import { MAGIC_EVENTS, AgentStatusEvent, TaskAssignmentEvent } from "@magic/shared-types";

// ---- Magic 自定义事件 ----
const onCustomEvent = (event: any, room: Room | undefined) => {
  if (!room) return;
  const type = event.getType();
  const content = event.getContent();
  const sender = event.getSender() ?? "";

  if (type === MAGIC_EVENTS.AGENT_STATUS) {
    const parsed = AgentStatusEvent.safeParse(content);
    if (parsed.success) {
      useAgentStore.getState().upsertAgent(room.roomId, parsed.data, sender);
    }
  }

  if (type === MAGIC_EVENTS.TASK_ASSIGNMENT) {
    const parsed = TaskAssignmentEvent.safeParse(content);
    if (parsed.success) {
      useAgentStore.getState().upsertTask(room.roomId, parsed.data);
    }
  }

  if (type === MAGIC_EVENTS.HEARTBEAT) {
    const agentId = content.agent_id as string;
    if (agentId) {
      useAgentStore.getState().updateHeartbeat(agentId, event.getTs());
    }
  }
};
client.on(RoomEvent.Timeline, onCustomEvent);
// 同时在 State Events 更新时触发
client.on(RoomStateEvent.Events, (event: any) => {
  const room = client.getRoom(event.getRoomId());
  onCustomEvent(event, room ?? undefined);
});

// 在 cleanup 中追加：
// client.off(RoomStateEvent.Events, onStateEvent);
```

### 3.4 useAgentStatus.ts — Agent 状态 Hook

```typescript
// packages/ui/src/hooks/useAgentStatus.ts
import { useMemo } from "react";
import { useAgentStore, type AgentData } from "@magic/matrix-client";

const HEARTBEAT_TIMEOUT = 60_000; // 60 秒无心跳视为离线

export function useAgentStatus(roomId: string | null) {
  const allAgents = useAgentStore((s) => s.agents);

  const agents = useMemo(() => {
    if (!roomId) return [];
    const now = Date.now();

    return Object.values(allAgents)
      .filter((a) => a.roomId === roomId)
      .map((agent) => ({
        ...agent,
        // 根据心跳判断实际在线状态
        effectiveStatus: getEffectiveStatus(agent, now),
      }))
      .sort((a, b) => {
        // 活跃优先 → 空闲 → 离线 → 错误
        const order = { active: 0, idle: 1, offline: 2, error: 3 };
        return (order[a.effectiveStatus] ?? 4) - (order[b.effectiveStatus] ?? 4);
      });
  }, [allAgents, roomId]);

  const summary = useMemo(() => ({
    total: agents.length,
    active: agents.filter((a) => a.effectiveStatus === "active").length,
    idle: agents.filter((a) => a.effectiveStatus === "idle").length,
    offline: agents.filter((a) => a.effectiveStatus === "offline").length,
    error: agents.filter((a) => a.effectiveStatus === "error").length,
  }), [agents]);

  return { agents, summary };
}

function getEffectiveStatus(
  agent: AgentData,
  now: number,
): AgentData["status"] {
  // 如果心跳超时，强制为 offline
  if (agent.status === "active" || agent.status === "idle") {
    if (now - agent.lastHeartbeat > HEARTBEAT_TIMEOUT) {
      return "offline";
    }
  }
  return agent.status;
}
```

### 3.5 useTaskBoard.ts — 任务看板 Hook

```typescript
// packages/ui/src/hooks/useTaskBoard.ts
import { useMemo } from "react";
import { useAgentStore, type TaskData } from "@magic/matrix-client";

export interface TaskColumn {
  key: TaskData["status"];
  label: string;
  color: string;
  tasks: TaskData[];
}

export function useTaskBoard(roomId: string | null) {
  const allTasks = useAgentStore((s) => s.tasks);

  const columns: TaskColumn[] = useMemo(() => {
    if (!roomId) return [];

    const roomTasks = Object.values(allTasks).filter((t) => t.roomId === roomId);

    const grouped: Record<TaskData["status"], TaskData[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      failed: [],
    };

    for (const task of roomTasks) {
      grouped[task.status]?.push(task);
    }

    // 每列内按优先级排序
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    for (const tasks of Object.values(grouped)) {
      tasks.sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));
    }

    return [
      { key: "pending" as const, label: "待处理", color: "text-gray-400", tasks: grouped.pending },
      { key: "in_progress" as const, label: "进行中", color: "text-blue-400", tasks: grouped.in_progress },
      { key: "completed" as const, label: "已完成", color: "text-green-400", tasks: grouped.completed },
      { key: "failed" as const, label: "失败", color: "text-red-400", tasks: grouped.failed },
    ];
  }, [allTasks, roomId]);

  const totalTasks = columns.reduce((sum, col) => sum + col.tasks.length, 0);

  return { columns, totalTasks };
}
```

### 3.6 AgentStatusDot.tsx — 状态指示点

```tsx
// packages/ui/src/agents/AgentStatusDot.tsx
import { memo } from "react";

interface AgentStatusDotProps {
  status: "active" | "idle" | "offline" | "error";
  size?: "sm" | "md";
  pulse?: boolean;
}

const statusColors = {
  active: "bg-green-500",
  idle: "bg-yellow-500",
  offline: "bg-gray-500",
  error: "bg-red-500",
};

const statusLabels = {
  active: "活跃",
  idle: "空闲",
  offline: "离线",
  error: "异常",
};

export const AgentStatusDot = memo(function AgentStatusDot({
  status,
  size = "sm",
  pulse = false,
}: AgentStatusDotProps) {
  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  return (
    <span className="relative inline-flex" title={statusLabels[status]}>
      <span className={`inline-block rounded-full ${dotSize} ${statusColors[status]}`} />
      {pulse && status === "active" && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${statusColors[status]} opacity-40`} />
      )}
    </span>
  );
});
```

### 3.7 AgentStatusCard.tsx — 单个 Agent 卡片

```tsx
// packages/ui/src/agents/AgentStatusCard.tsx
import { memo } from "react";
import { RoomAvatar } from "../rooms/RoomAvatar";
import { AgentStatusDot } from "./AgentStatusDot";
import type { AgentData } from "@magic/matrix-client";

interface AgentStatusCardProps {
  agent: AgentData & { effectiveStatus: AgentData["status"] };
  taskName?: string;
}

export const AgentStatusCard = memo(function AgentStatusCard({
  agent,
  taskName,
}: AgentStatusCardProps) {
  const displayName = extractName(agent.userId);

  return (
    <div className="rounded-xl border border-gray-800 bg-magic-surface-alt p-3 transition-colors hover:border-gray-700">
      {/* 头部：头像 + 名称 + 状态 */}
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <RoomAvatar name={displayName} avatarMxc={null} isDirect size={32} />
          <span className="absolute -bottom-0.5 -right-0.5">
            <AgentStatusDot status={agent.effectiveStatus} size="sm" pulse />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{displayName}</p>
          <p className="truncate text-xs text-gray-500">
            {agent.model ?? "Agent"}
          </p>
        </div>
      </div>

      {/* 当前任务 */}
      {taskName && (
        <div className="mt-2 rounded-lg bg-magic-surface px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">当前任务</p>
          <p className="mt-0.5 truncate text-xs text-gray-300">{taskName}</p>
        </div>
      )}

      {/* 能力标签 */}
      {agent.capabilities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.capabilities.slice(0, 3).map((cap) => (
            <span
              key={cap}
              className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400"
            >
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="text-[10px] text-gray-500">
              +{agent.capabilities.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

function extractName(userId: string): string {
  const match = userId.match(/^@([^:]+)/);
  return match ? match[1] : userId;
}
```

### 3.8 AgentStatusGrid.tsx — Agent 卡片网格

```tsx
// packages/ui/src/agents/AgentStatusGrid.tsx
import { useAgentStatus } from "../hooks/useAgentStatus";
import { useAgentStore } from "@magic/matrix-client";
import { AgentStatusCard } from "./AgentStatusCard";

interface AgentStatusGridProps {
  roomId: string;
}

export function AgentStatusGrid({ roomId }: AgentStatusGridProps) {
  const { agents, summary } = useAgentStatus(roomId);
  const tasks = useAgentStore((s) => s.tasks);

  if (agents.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        当前房间暂无 Agent
      </div>
    );
  }

  return (
    <div>
      {/* 状态摘要 */}
      <div className="mb-3 flex items-center gap-3 text-xs text-gray-500">
        <span>{summary.total} 个 Agent</span>
        <span className="text-green-500">● {summary.active} 活跃</span>
        <span className="text-yellow-500">● {summary.idle} 空闲</span>
        {summary.offline > 0 && <span className="text-gray-500">● {summary.offline} 离线</span>}
        {summary.error > 0 && <span className="text-red-500">● {summary.error} 异常</span>}
      </div>

      {/* 卡片网格 */}
      <div className="grid grid-cols-1 gap-2">
        {agents.map((agent) => {
          const currentTask = agent.currentTaskId
            ? tasks[agent.currentTaskId]
            : undefined;
          return (
            <AgentStatusCard
              key={agent.agentId}
              agent={agent}
              taskName={currentTask?.title}
            />
          );
        })}
      </div>
    </div>
  );
}
```

### 3.9 TaskCard.tsx — 任务卡片

```tsx
// packages/ui/src/agents/TaskCard.tsx
import { memo } from "react";
import type { TaskData } from "@magic/matrix-client";

interface TaskCardProps {
  task: TaskData;
}

const priorityColors = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-blue-500",
  low: "border-l-gray-500",
};

const priorityLabels = {
  critical: "紧急",
  high: "高",
  medium: "中",
  low: "低",
};

export const TaskCard = memo(function TaskCard({ task }: TaskCardProps) {
  const assigneeName = task.assignee.match(/^@([^:]+)/)?.[1] ?? task.assignee;

  return (
    <div className={`rounded-lg border border-gray-800 border-l-2 ${priorityColors[task.priority]}
                     bg-magic-surface-alt p-2.5 transition-colors hover:border-gray-700`}>
      <p className="text-sm font-medium text-gray-200 line-clamp-2">{task.title}</p>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          → {assigneeName}
        </span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
          task.priority === "critical" ? "bg-red-500/20 text-red-400"
          : task.priority === "high" ? "bg-orange-500/20 text-orange-400"
          : "bg-gray-800 text-gray-400"
        }`}>
          {priorityLabels[task.priority]}
        </span>
      </div>

      {task.dueDate && (
        <p className="mt-1 text-[10px] text-gray-600">
          截止: {task.dueDate}
        </p>
      )}
    </div>
  );
});
```

### 3.10 TaskBoard.tsx — 任务看板

```tsx
// packages/ui/src/agents/TaskBoard.tsx
import { useTaskBoard } from "../hooks/useTaskBoard";
import { TaskCard } from "./TaskCard";

interface TaskBoardProps {
  roomId: string;
}

export function TaskBoard({ roomId }: TaskBoardProps) {
  const { columns, totalTasks } = useTaskBoard(roomId);

  if (totalTasks === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        当前房间暂无任务
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div key={col.key} className="w-56 shrink-0">
          {/* 列标题 */}
          <div className="mb-2 flex items-center justify-between">
            <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>
              {col.label}
            </span>
            <span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">
              {col.tasks.length}
            </span>
          </div>

          {/* 任务卡片 */}
          <div className="space-y-2">
            {col.tasks.map((task) => (
              <TaskCard key={task.taskId} task={task} />
            ))}
            {col.tasks.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-800 py-6 text-center text-xs text-gray-600">
                暂无
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 3.11 CollaborationGraph.tsx — ECharts 协作图

```tsx
// packages/ui/src/agents/CollaborationGraph.tsx
import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { useAgentStatus } from "../hooks/useAgentStatus";
import { useAgentStore } from "@magic/matrix-client";

interface CollaborationGraphProps {
  roomId: string;
}

export function CollaborationGraph({ roomId }: CollaborationGraphProps) {
  const { agents } = useAgentStatus(roomId);
  const tasks = useAgentStore((s) => s.tasks);

  const option = useMemo(() => {
    // 节点：每个 Agent
    const nodes = agents.map((agent) => ({
      id: agent.agentId,
      name: agent.userId.match(/^@([^:]+)/)?.[1] ?? agent.agentId,
      symbolSize: agent.effectiveStatus === "active" ? 40 : 28,
      category: agent.effectiveStatus === "active" ? 0
                : agent.effectiveStatus === "idle" ? 1
                : agent.effectiveStatus === "error" ? 3 : 2,
      itemStyle: {
        color: agent.effectiveStatus === "active" ? "#22c55e"
              : agent.effectiveStatus === "idle" ? "#eab308"
              : agent.effectiveStatus === "error" ? "#ef4444" : "#6b7280",
      },
      label: { show: true, fontSize: 10, color: "#d1d5db" },
    }));

    // 边：共享同一任务的 Agent 之间连线
    const links: Array<{ source: string; target: string; value: number }> = [];
    const taskList = Object.values(tasks).filter((t) => t.roomId === roomId);

    // 简单协作关系：同房间的 Agent 之间都有潜在协作
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        // 检查是否有任务关联
        const hasSharedContext = agents[i].currentTaskId && agents[j].currentTaskId;
        links.push({
          source: agents[i].agentId,
          target: agents[j].agentId,
          value: hasSharedContext ? 2 : 1,
        });
      }
    }

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          if (params.dataType === "node") {
            const agent = agents.find((a) => a.agentId === params.data.id);
            if (!agent) return params.name;
            return `${params.name}<br/>状态: ${agent.effectiveStatus}<br/>模型: ${agent.model ?? "-"}`;
          }
          return "";
        },
      },
      series: [{
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        force: {
          repulsion: 120,
          edgeLength: [80, 160],
          gravity: 0.1,
        },
        data: nodes,
        links,
        lineStyle: {
          color: "#374151",
          width: 1,
          curveness: 0.1,
        },
        emphasis: {
          focus: "adjacency",
          lineStyle: { width: 3, color: "#3b82f6" },
        },
        categories: [
          { name: "活跃" },
          { name: "空闲" },
          { name: "离线" },
          { name: "异常" },
        ],
      }],
    };
  }, [agents, tasks, roomId]);

  if (agents.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        暂无 Agent 协作数据
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 300 }}
      opts={{ renderer: "canvas" }}
      notMerge={true}
    />
  );
}
```

### 3.12 AgentDashboard.tsx — 仪表盘容器

```tsx
// packages/ui/src/agents/AgentDashboard.tsx
import { useState } from "react";
import { AgentStatusGrid } from "./AgentStatusGrid";
import { TaskBoard } from "./TaskBoard";
import { CollaborationGraph } from "./CollaborationGraph";

interface AgentDashboardProps {
  roomId: string;
}

type TabKey = "agents" | "tasks" | "graph";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "agents", label: "Agent 状态" },
  { key: "tasks", label: "任务看板" },
  { key: "graph", label: "协作图" },
];

export function AgentDashboard({ roomId }: AgentDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("agents");

  return (
    <div className="flex h-full flex-col">
      {/* 标签栏 */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-magic-primary text-magic-primary"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "agents" && <AgentStatusGrid roomId={roomId} />}
        {activeTab === "tasks" && <TaskBoard roomId={roomId} />}
        {activeTab === "graph" && <CollaborationGraph roomId={roomId} />}
      </div>
    </div>
  );
}
```

### 3.13 更新 MainLayout.tsx — 右侧面板

在 004 的 MainLayout 中，当 `rightPanelMode === "agents"` 时渲染 AgentDashboard：

```tsx
// packages/ui/src/layouts/MainLayout.tsx（追加右侧面板）
import { useUIStore, useRoomStore } from "@magic/matrix-client";
import { AgentDashboard } from "../agents/AgentDashboard";

// 在 MainLayout 的 return 中，ChatView 后面追加：
{rightPanelOpen && activeRoomId && (
  <aside className="w-80 border-l border-gray-800 bg-magic-surface-alt flex flex-col">
    <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
      <span className="text-sm font-semibold text-white">
        {rightPanelMode === "agents" ? "Agent 面板" : rightPanelMode}
      </span>
      <button
        onClick={closeRightPanel}
        className="rounded p-1 text-gray-500 hover:bg-gray-700 hover:text-white transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div className="flex-1 min-h-0">
      {rightPanelMode === "agents" && <AgentDashboard roomId={activeRoomId} />}
    </div>
  </aside>
)}
```

同时在 ChatHeader 中增加一个打开 Agent 面板的按钮：

```tsx
// ChatHeader.tsx 追加按钮：
<button
  onClick={() => setRightPanel("agents")}
  className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
  title="Agent 面板"
>
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
          d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
  </svg>
</button>
```

### 3.14 更新导出

**matrix-client/src/index.ts** 追加：
```typescript
export { useAgentStore } from "./stores/agentStore";
export type { AgentData, TaskData } from "./stores/agentStore";
```

**ui/src/index.ts** 追加：
```typescript
// Agents
export { AgentDashboard } from "./agents/AgentDashboard";
export { AgentStatusGrid } from "./agents/AgentStatusGrid";
export { AgentStatusCard } from "./agents/AgentStatusCard";
export { AgentStatusDot } from "./agents/AgentStatusDot";
export { TaskBoard } from "./agents/TaskBoard";
export { TaskCard } from "./agents/TaskCard";
export { CollaborationGraph } from "./agents/CollaborationGraph";

// Hooks
export { useAgentStatus } from "./hooks/useAgentStatus";
export { useTaskBoard } from "./hooks/useTaskBoard";
```

---

## 4. 验收标准

| # | 检查项 | 验证方式 |
|---|--------|---------|
| AC-1 | Agent 发送 `com.magic.agent.status` 事件后，Agent 卡片实时出现在面板中 | 模拟发送自定义事件 |
| AC-2 | Agent 状态卡片显示名称、模型、状态点（绿/黄/灰/红）、能力标签 | 视觉检查 |
| AC-3 | 活跃 Agent 的状态点有脉冲动画 | 视觉检查 |
| AC-4 | 60 秒无心跳的 Agent 自动变为离线状态 | 等待 60 秒后检查 |
| AC-5 | 任务看板按四列展示（待处理/进行中/已完成/失败） | 视觉检查 |
| AC-6 | 任务卡片显示标题、负责人、优先级标签（颜色编码）、截止日期 | 视觉检查 |
| AC-7 | 协作图正确显示 Agent 节点和连线，支持拖拽和缩放 | 手动验证 |
| AC-8 | 标签切换（Agent 状态 / 任务看板 / 协作图）正常工作 | 手动验证 |
| AC-9 | ChatHeader 中的 Agent 面板按钮可打开/关闭右侧面板 | 手动验证 |
| AC-10 | 切换房间时面板内容更新为新房间的 Agent/任务 | 手动验证 |
| AC-11 | `pnpm typecheck` 全局通过 | `pnpm typecheck` |
| AC-12 | `pnpm test` 所有测试通过 | `pnpm test` |

---

## 5. 实现任务（按执行顺序）

### 任务 1：安装 ECharts 依赖

```bash
cd packages/ui && pnpm add echarts@^5.6.0 echarts-for-react@^3.0.0
```

**验证**：`pnpm install`

---

### 任务 2：创建 agentStore

**创建文件**：`packages/matrix-client/src/stores/agentStore.ts`

**修改文件**：
- `packages/matrix-client/src/stores/index.ts`
- `packages/matrix-client/src/index.ts`

**验证**：`pnpm typecheck`

---

### 任务 3：更新 bridge.ts 监听自定义事件

**修改文件**：`packages/matrix-client/src/bridge.ts`

**验证**：`pnpm typecheck`

---

### 任务 4：创建 useAgentStatus 和 useTaskBoard Hook

**创建文件**：
- `packages/ui/src/hooks/useAgentStatus.ts`
- `packages/ui/src/hooks/useTaskBoard.ts`

**验证**：`pnpm typecheck`

---

### 任务 5：创建 AgentStatusDot 和 AgentStatusCard

**创建文件**：
- `packages/ui/src/agents/AgentStatusDot.tsx`
- `packages/ui/src/agents/AgentStatusCard.tsx`

**验证**：`pnpm typecheck`

---

### 任务 6：创建 AgentStatusGrid

**创建文件**：`packages/ui/src/agents/AgentStatusGrid.tsx`

**验证**：`pnpm typecheck`

---

### 任务 7：创建 TaskCard 和 TaskBoard

**创建文件**：
- `packages/ui/src/agents/TaskCard.tsx`
- `packages/ui/src/agents/TaskBoard.tsx`

**验证**：`pnpm typecheck`

---

### 任务 8：创建 CollaborationGraph

**创建文件**：`packages/ui/src/agents/CollaborationGraph.tsx`

**验证**：`pnpm typecheck`

---

### 任务 9：创建 AgentDashboard 容器

**创建文件**：`packages/ui/src/agents/AgentDashboard.tsx`

**验证**：`pnpm typecheck`

---

### 任务 10：更新 MainLayout + ChatHeader 接入面板

**修改文件**：
- `packages/ui/src/layouts/MainLayout.tsx`（增加右侧面板渲染）
- `packages/ui/src/chat/ChatHeader.tsx`（增加 Agent 面板按钮）

**验证**：`pnpm dev:desktop`（打开 Agent 面板）

---

### 任务 11：更新导出

**修改文件**：
- `packages/matrix-client/src/index.ts`
- `packages/ui/src/index.ts`

**验证**：`pnpm typecheck && pnpm build`

---

### 任务 12：编写单元测试

**创建文件**：
- `packages/matrix-client/__tests__/stores/agentStore.test.ts` — upsertAgent、upsertTask、heartbeat
- `packages/ui/__tests__/agents/AgentStatusCard.test.tsx` — 状态渲染、能力标签
- `packages/ui/__tests__/hooks/useTaskBoard.test.ts` — 分列、排序

**验证**：`pnpm test`

---

### 任务 13：全局集成验证

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm dev:desktop   # 打开 Agent 面板，模拟自定义事件验证
```

完成后提交：
```bash
git add -A
git commit -m "feat: 010 - agent status dashboard with task board and collaboration graph"
```

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 无真实 Agent 发送自定义事件进行测试 | 无法验证面板 | 在 DevTools Console 中用 SDK 手动发送 `sendAgentStatus()` 模拟 |
| ECharts 包体积较大（~800KB gzipped） | 首屏加载慢 | lazy import `CollaborationGraph` 组件 |
| 心跳超时判断不准确（时钟漂移） | Agent 误判为离线 | 使用服务器时间戳而非本地时间，60 秒容忍度足够 |
| 右侧面板挤压聊天区域 | 窄屏体验差 | 面板宽度 320px，聊天区最小宽度 480px，窄屏自动隐藏面板 |

---

## 7. 后续 Spec 的接入点

- **011-soul-memory-editor**：在 AgentDashboard 增加第四个标签"SOUL/MEMORY"
- **后续任务操作 spec**：在 TaskCard 上增加状态变更按钮、在 TaskBoard 增加拖拽排序
- **后续 Agent 指标 spec**：在 AgentDashboard 增加 Recharts 历史趋势图（Token 消耗、响应时间等）
- **后续右侧面板 spec**：扩展 MainLayout 右侧面板支持 "members" / "files" / "settings" 模式