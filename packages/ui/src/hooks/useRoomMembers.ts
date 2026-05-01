import { useMemo } from "react";
import {
  getClient,
  hasClient,
  useAgentStore,
  useAuthStore,
  type AgentData,
} from "@magic/matrix-client";

export interface RoomMember {
  userId: string;
  displayName: string;
  avatarMxc: string | null;
  isAgent: boolean;
  agentStatus?: AgentData["status"];
  agentRuntime?: string;
  powerLevel: number;
}

export function useRoomMembers(roomId: string | null): RoomMember[] {
  const currentUserId = useAuthStore((s) => s.userId);
  const agents = useAgentStore((s) => s.agents);

  return useMemo(() => {
    if (!roomId || !hasClient()) return [];

    const client = getClient();
    const room = client.getRoom(roomId);
    if (!room) return [];

    const agentsByUser = new Map<string, AgentData>();
    for (const agent of Object.values(agents)) {
      if (agent.roomId === roomId) {
        agentsByUser.set(agent.userId, agent);
      }
    }

    return room
      .getJoinedMembers()
      .filter((m) => m.userId !== currentUserId)
      .map((member): RoomMember => {
        const agentData = agentsByUser.get(member.userId);
        return {
          userId: member.userId,
          displayName: member.name || extractName(member.userId),
          avatarMxc: member.getMxcAvatarUrl() ?? null,
          isAgent: !!agentData,
          agentStatus: agentData?.status,
          agentRuntime: agentData?.model,
          powerLevel: member.powerLevel,
        };
      })
      .sort((a, b) => {
        if (a.isAgent !== b.isAgent) return a.isAgent ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [roomId, agents, currentUserId]);
}

function extractName(userId: string): string {
  const match = userId.match(/^@([^:]+)/);
  return match ? match[1] : userId;
}
