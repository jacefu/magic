import { useAgentStore } from "@magic/matrix-client";
import { useAgentStatus } from "../hooks/useAgentStatus.js";
import { AgentStatusCard } from "./AgentStatusCard.js";

interface AgentStatusGridProps {
  roomId: string;
}

export function AgentStatusGrid({ roomId }: AgentStatusGridProps) {
  const { agents, summary } = useAgentStatus(roomId);
  const tasks = useAgentStore((s) => s.tasks);

  if (agents.length === 0) {
    return (
      <div className="space-y-2 px-2 py-8 text-center">
        <p className="text-sm text-text-muted">当前房间暂无 Agent</p>
        <p className="text-xs leading-relaxed text-text-faint">
          只有发布 <code className="rounded bg-bg-secondary px-1 py-0.5 text-[10px]">com.magic.agent.status</code> 状态事件的 Worker
          会出现在这里。普通 Matrix 成员不会被识别为 Agent。
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span>{summary.total} 个 Agent</span>
        <span className="text-green">● {summary.active} 活跃</span>
        <span className="text-yellow">● {summary.idle} 空闲</span>
        {summary.offline > 0 && (
          <span className="text-text-muted">● {summary.offline} 离线</span>
        )}
        {summary.error > 0 && (
          <span className="text-red">● {summary.error} 异常</span>
        )}
      </div>

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
