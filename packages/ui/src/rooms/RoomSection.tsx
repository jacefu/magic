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
//   text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#949BA4]
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
        className="flex w-full items-center gap-1 px-2 pt-4 pb-1
                   text-[10.5px] font-bold uppercase tracking-[0.04em]
                   text-[#949BA4] transition-colors hover:text-[#DBDEE1]"
      >
        <ChevronIcon collapsed={collapsed} />
        <span>{label}</span>
        <span className="ml-auto font-medium text-[#6D6F78]">{rooms.length}</span>
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

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`h-2.5 w-2.5 transition-transform ${collapsed ? "" : "rotate-90"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
