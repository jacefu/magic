import { memo } from "react";
import type { RoomData } from "@magic/matrix-client";
import { RoomListItem } from "./RoomListItem.js";

interface RoomSectionProps {
  label: string;
  rooms: RoomData[];
  collapsed: boolean;
  onToggle: () => void;
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
}

// Section header per design-system § 4.1:
//   text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]
//   ▾ chevron rotates between expanded/collapsed states
//   spacing: top 16px, bottom 4px
export const RoomSection = memo(function RoomSection({
  label,
  rooms,
  collapsed,
  onToggle,
  activeRoomId,
  onSelectRoom,
}: RoomSectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center px-3 pt-4 pb-1
                   text-[10.5px] font-bold uppercase tracking-[0.04em]
                   text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
      >
        <span className="truncate">{label}</span>
        <span className="ml-1 inline-block w-3 text-[10px] leading-none">
          {collapsed ? "▸" : "▾"}
        </span>
        <span className="ml-auto font-medium text-[var(--text-tertiary)]">{rooms.length}</span>
      </button>

      {!collapsed && (
        <div className="space-y-px">
          {rooms.map((room) => (
            <RoomListItem
              key={room.roomId}
              room={room}
              isActive={room.roomId === activeRoomId}
              onSelect={() => onSelectRoom(room.roomId)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
