import { memo, useMemo } from "react";
import {
  getClient,
  hasClient,
  useAgentRegistryStore,
  useAgentStore,
  useAuthStore,
  usePresenceStore,
  type RoomData,
} from "@magic/matrix-client";
import { getStatusColor } from "../lib/agentDetection.js";
import { isDmRoom } from "../lib/isDmRoom.js";
import { UnreadBadge } from "./UnreadBadge.js";

interface RoomListItemProps {
  room: RoomData;
  isActive: boolean;
  onSelect: () => void;
}

/** Find the non-self member of a DM room. Returns null if not a DM or no peer. */
function useDmPeerId(roomId: string, isDm: boolean): string | null {
  const currentUserId = useAuthStore((s) => s.userId);
  return useMemo(() => {
    if (!isDm || !currentUserId || !hasClient()) return null;
    const room = getClient().getRoom(roomId);
    if (!room) return null;
    const peer = room
      .getJoinedMembers()
      .find((m) => m.userId !== currentUserId);
    return peer?.userId ?? null;
  }, [roomId, isDm, currentUserId]);
}

// Discord-channel layout per design-system § 7.2:
//   - 30px row height, padding 5px 10px, 1px gap
//   - Group rooms: # prefix + name (single line)
//   - DMs: 8px status dot + name (color from agentDetection)
//   - default text #949BA4, hover #DBDEE1 + bg #35373C, active white + bg #404249,
//     unread #DBDEE1 + font-weight 600
//   - UnreadBadge on the right
export const RoomListItem = memo(function RoomListItem({
  room,
  isActive,
  onSelect,
}: RoomListItemProps) {
  const isUnread = room.unreadCount > 0;
  const name = room.name || "未命名房间";

  // Subscribe to the stores that feed getStatusColor so the dot recolors live.
  useAgentStore((s) => s.agents);
  useAgentRegistryStore((s) => s.agents);
  useAgentRegistryStore((s) => s.loaded);
  usePresenceStore((s) => s.presences);

  const isDm = isDmRoom(room);
  const dmPeerId = useDmPeerId(room.roomId, isDm);
  const dmStatusColor = dmPeerId
    ? getStatusColor(dmPeerId, room.roomId)
    : "#6D6F78";

  return (
    <button
      onClick={onSelect}
      className={`mx-1.5 flex h-[30px] w-[calc(100%-12px)] items-center gap-1.5
                  rounded-[4px] px-2.5 py-[5px] text-left
                  transition-colors duration-100 ${
                    isActive
                      ? "bg-[#404249] text-white"
                      : isUnread
                        ? "text-[#DBDEE1] hover:bg-[#35373C]"
                        : "text-[#949BA4] hover:bg-[#35373C] hover:text-[#DBDEE1]"
                  }`}
    >
      {isDm ? (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: dmStatusColor }}
          aria-hidden
        />
      ) : (
        <span className="shrink-0 text-[16px] leading-none opacity-60">#</span>
      )}

      <span
        className={`truncate text-[13px] ${
          isUnread || isActive ? "font-semibold" : "font-medium"
        }`}
      >
        {name}
      </span>

      <div className="ml-auto shrink-0">
        <UnreadBadge count={room.unreadCount} highlight={room.highlightCount > 0} />
      </div>
    </button>
  );
});
