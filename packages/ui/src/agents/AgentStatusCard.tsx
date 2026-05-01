import { memo } from "react";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import { AgentStatusDot } from "./AgentStatusDot.js";
import type { AgentWithEffectiveStatus } from "../hooks/useAgentStatus.js";

interface AgentStatusCardProps {
  agent: AgentWithEffectiveStatus;
  taskName?: string;
}

export const AgentStatusCard = memo(function AgentStatusCard({
  agent,
  taskName,
}: AgentStatusCardProps) {
  const displayName = extractName(agent.userId);

  return (
    <div className="rounded-xl border border-gray-800 bg-magic-surface-alt p-3 transition-colors hover:border-gray-700">
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <RoomAvatar name={displayName} avatarMxc={null} isDirect size={32} />
          <span className="absolute -bottom-0.5 -right-0.5">
            <AgentStatusDot status={agent.effectiveStatus} size="sm" pulse />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{displayName}</p>
          <p className="truncate text-xs text-gray-500">{agent.model ?? "Agent"}</p>
        </div>
      </div>

      {taskName && (
        <div className="mt-2 rounded-lg bg-magic-surface px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">
            当前任务
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-300">{taskName}</p>
        </div>
      )}

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
