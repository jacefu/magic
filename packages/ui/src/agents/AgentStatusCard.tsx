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
    <div className="rounded-xl border border-divider-light bg-bg-secondary p-3 transition-colors hover:border-divider">
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <RoomAvatar name={displayName} avatarMxc={null} isDirect size={32} />
          <span className="absolute -bottom-0.5 -right-0.5">
            <AgentStatusDot status={agent.effectiveStatus} size="sm" pulse />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-normal">{displayName}</p>
          <p className="truncate text-xs text-text-muted">{agent.model ?? "Agent"}</p>
        </div>
      </div>

      {taskName && (
        <div className="mt-2 rounded-lg bg-bg-primary px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">
            当前任务
          </p>
          <p className="mt-0.5 truncate text-xs text-text-normal">{taskName}</p>
        </div>
      )}

      {agent.capabilities.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.capabilities.slice(0, 3).map((cap) => (
            <span
              key={cap}
              className="rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] text-text-muted"
            >
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="text-[10px] text-text-muted">
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
