import { useMemo } from "react";
import {
  getClient,
  hasClient,
  useAgentRegistryStore,
  useAgentStore,
  useAuthStore,
} from "@magic/matrix-client";
import { getAgentInfo, type AgentInfo } from "../lib/agentDetection.js";

export interface RoomMember {
  userId: string;
  displayName: string;
  avatarMxc: string | null;
  isAgent: boolean;
  agentRuntime?: AgentInfo["runtime"];
  agentInfo: AgentInfo;
  powerLevel: number;
  /** True when this row represents the locally-logged-in user. The
   *  MemberPanel uses this to suffix "(我)" and to skip the
   *  start-DM action (no point DMing yourself). */
  isSelf: boolean;
}

export function useRoomMembers(roomId: string | null): RoomMember[] {
  const currentUserId = useAuthStore((s) => s.userId);
  // Subscribe to the stores agentDetection reads from so the memo
  // re-runs when registry / agent.status events arrive. Online status
  // is now sourced from `client.getUser().presence` directly in the
  // consumers (MemberPanel / RoomListItem) — no store subscription
  // needed for that.
  const agents = useAgentStore((s) => s.agents);
  const registryAgents = useAgentRegistryStore((s) => s.agents);
  const registryLoaded = useAgentRegistryStore((s) => s.loaded);
  const registryError = useAgentRegistryStore((s) => s.error);

  return useMemo(() => {
    if (!roomId || !hasClient()) return [];

    const client = getClient();
    const room = client.getRoom(roomId);
    if (!room) return [];

    // Spec 022 v6 follow-up — include the local user. Sort puts
    // agents first, then the local user, then everyone else, so a
    // human visually sees "AI teammates → me → other humans".
    return room
      .getJoinedMembers()
      .map((member): RoomMember => {
        const info = getAgentInfo(member.userId, roomId);
        return {
          userId: member.userId,
          displayName: member.name || extractName(member.userId),
          avatarMxc: member.getMxcAvatarUrl() ?? null,
          isAgent: info.isAgent,
          agentRuntime: info.runtime,
          agentInfo: info,
          powerLevel: member.powerLevel,
          isSelf: member.userId === currentUserId,
        };
      })
      .sort((a, b) => {
        if (a.isAgent !== b.isAgent) return a.isAgent ? -1 : 1;
        if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [
    roomId,
    agents,
    registryAgents,
    registryLoaded,
    registryError,
    currentUserId,
  ]);
}

function extractName(userId: string): string {
  const match = userId.match(/^@([^:]+)/);
  return match ? match[1] : userId;
}
