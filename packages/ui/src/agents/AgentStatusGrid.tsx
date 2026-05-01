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
      <div className="py-8 text-center text-sm text-gray-500">
        当前房间暂无 Agent
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span>{summary.total} 个 Agent</span>
        <span className="text-green-500">● {summary.active} 活跃</span>
        <span className="text-yellow-500">● {summary.idle} 空闲</span>
        {summary.offline > 0 && (
          <span className="text-gray-500">● {summary.offline} 离线</span>
        )}
        {summary.error > 0 && (
          <span className="text-red-500">● {summary.error} 异常</span>
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
