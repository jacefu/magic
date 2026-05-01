import { useMemo } from "react";
import { useAgentStore, type AgentData } from "@magic/matrix-client";

const HEARTBEAT_TIMEOUT = 60_000;

export interface AgentWithEffectiveStatus extends AgentData {
  effectiveStatus: AgentData["status"];
}

export function useAgentStatus(roomId: string | null) {
  const allAgents = useAgentStore((s) => s.agents);

  const agents = useMemo<AgentWithEffectiveStatus[]>(() => {
    if (!roomId) return [];
    const now = Date.now();

    const order: Record<AgentData["status"], number> = {
      active: 0,
      idle: 1,
      offline: 2,
      error: 3,
    };

    return Object.values(allAgents)
      .filter((a) => a.roomId === roomId)
      .map((agent) => ({
        ...agent,
        effectiveStatus: getEffectiveStatus(agent, now),
      }))
      .sort((a, b) => order[a.effectiveStatus] - order[b.effectiveStatus]);
  }, [allAgents, roomId]);

  const summary = useMemo(
    () => ({
      total: agents.length,
      active: agents.filter((a) => a.effectiveStatus === "active").length,
      idle: agents.filter((a) => a.effectiveStatus === "idle").length,
      offline: agents.filter((a) => a.effectiveStatus === "offline").length,
      error: agents.filter((a) => a.effectiveStatus === "error").length,
    }),
    [agents],
  );

  return { agents, summary };
}

function getEffectiveStatus(
  agent: AgentData,
  now: number,
): AgentData["status"] {
  if (agent.status === "active" || agent.status === "idle") {
    if (now - agent.lastHeartbeat > HEARTBEAT_TIMEOUT) {
      return "offline";
    }
  }
  return agent.status;
}
