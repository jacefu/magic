import { memo } from "react";
import {
  useAgentRegistryStore,
  useAgentStore,
  type RoomData,
} from "@magic/matrix-client";
import { isDmRoom } from "../lib/isDmRoom.js";
import { UnreadBadge } from "./UnreadBadge.js";

interface RoomListItemProps {
  room: RoomData;
  isActive: boolean;
  onSelect: () => void;
}

// Spec 019 FIX-1 — Tuwunel's Matrix Presence is unreliable enough that
// the on/off dot was lying often enough to mislead users. The dot is
// gone for now; DMs get a simple "@" prefix matching the "#" used for
// group rooms. presenceUtils / presenceStore stay in the tree for a
// future revival once Presence is reliable.
export const RoomListItem = memo(function RoomListItem({
  room,
  isActive,
  onSelect,
}: RoomListItemProps) {
  const isUnread = room.unreadCount > 0;
  const name = room.name || "未命名房间";

  // Subscribe so a registry-driven re-tag (e.g. agent label resolution
  // landing late) still triggers a re-render of the row.
  useAgentStore((s) => s.agents);
  useAgentRegistryStore((s) => s.agents);
  useAgentRegistryStore((s) => s.loaded);

  const isDm = isDmRoom(room);

  // Spec § 7.2 — selected items get a theme-aware translucent
  // purple→cyan gradient + a subtle brand-tinted border. Both come
  // from CSS variables so the active state reshapes to suit the
  // current theme automatically.
  const activeStyle: React.CSSProperties | undefined = isActive
    ? {
        background: "var(--bg-active)",
        borderColor: "var(--border-active)",
      }
    : undefined;

  return (
    <button
      onClick={onSelect}
      className={`mx-1.5 flex h-[30px] w-[calc(100%-12px)] items-center gap-1.5
                  rounded-lg border-[0.5px] border-transparent px-2.5 py-[5px] text-left
                  transition-colors duration-150 ${
                    isActive
                      ? "text-[var(--text-primary)]"
                      : isUnread
                        ? "text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                        : "text-[var(--text-room-default)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                  }`}
      style={activeStyle}
    >
      <span
        className="w-4 shrink-0 text-center leading-none text-[var(--text-room-prefix)]"
        style={{ fontSize: isDm ? 13 : 14 }}
        aria-hidden
      >
        {isDm ? "@" : "#"}
      </span>

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
