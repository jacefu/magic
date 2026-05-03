import { memo, useMemo } from "react";
import {
  getClient,
  hasClient,
  useAgentRegistryStore,
  useAgentStore,
  useAuthStore,
  type RoomData,
} from "@magic/matrix-client";
import {
  getUserPresence,
  getPresenceColor,
} from "../lib/presenceUtils.js";
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
//   - DMs: 8px status dot + name (color from Matrix presence)
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

  // Subscribe to agent stores so a registry-driven re-tag still re-renders.
  // Presence itself is read directly from matrix-js-sdk, which doesn't need
  // a Zustand subscription — but the dot will repaint on the next render
  // triggered by any of these stores or by the parent list refresh.
  useAgentStore((s) => s.agents);
  useAgentRegistryStore((s) => s.agents);
  useAgentRegistryStore((s) => s.loaded);

  const isDm = isDmRoom(room);
  const dmPeerId = useDmPeerId(room.roomId, isDm);
  const dmStatusColor = dmPeerId
    ? getPresenceColor(getUserPresence(dmPeerId))
    : "rgba(255,255,255,0.15)";
  const dmStatusGlow =
    dmStatusColor === "#00F5A0"
      ? "0 0 6px rgba(0,245,160,0.4)"
      : dmStatusColor === "#FBBF24"
        ? "0 0 6px rgba(251,191,36,0.3)"
        : dmStatusColor === "#F43F5E"
          ? "0 0 6px rgba(244,63,94,0.3)"
          : undefined;

  // Cosmic AI § 7.2 — selected items get a translucent purple→cyan
  // gradient + a subtle brand-tinted border instead of a flat grey.
  const activeStyle: React.CSSProperties | undefined = isActive
    ? {
        background:
          "linear-gradient(135deg, rgba(108,92,231,0.12), rgba(0,180,216,0.08))",
        borderColor: "rgba(108,92,231,0.2)",
      }
    : undefined;

  return (
    <button
      onClick={onSelect}
      className={`mx-1.5 flex h-[30px] w-[calc(100%-12px)] items-center gap-1.5
                  rounded-lg border-[0.5px] border-transparent px-2.5 py-[5px] text-left
                  transition-colors duration-150 ${
                    isActive
                      ? "text-white"
                      : isUnread
                        ? "text-[rgba(255,255,255,0.85)] hover:bg-[rgba(255,255,255,0.04)]"
                        : "text-[rgba(255,255,255,0.4)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.7)]"
                  }`}
      style={activeStyle}
    >
      {isDm ? (
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: dmStatusColor, boxShadow: dmStatusGlow }}
          aria-hidden
        />
      ) : (
        <span className="shrink-0 text-[14px] leading-none opacity-40">#</span>
      )}

      <span
        className={`truncate text-[12.5px] ${
          isUnread || isActive ? "font-medium" : "font-normal"
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
