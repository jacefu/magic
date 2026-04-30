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

export const RoomSection = memo(function RoomSection({
  label,
  rooms,
  collapsed,
  onToggle,
  activeRoomId,
  onSelectRoom,
}: RoomSectionProps) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs font-semibold
                   uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
      >
        <ChevronIcon collapsed={collapsed} />
        <span>{label}</span>
        <span className="ml-auto text-gray-600">{rooms.length}</span>
      </button>

      {!collapsed && (
        <div className="space-y-0.5">
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
      className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-90"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
