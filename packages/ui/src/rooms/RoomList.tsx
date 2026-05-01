import { useState } from "react";
import { useRoomStore } from "@magic/matrix-client";
import { useFilteredRooms } from "../hooks/useFilteredRooms.js";
import { RoomSection } from "./RoomSection.js";
import { RoomSearchInput } from "./RoomSearchInput.js";
import { CreateRoomDialog } from "./CreateRoomDialog.js";
import { JoinRoomDialog } from "./JoinRoomDialog.js";

export function RoomList() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const setActiveRoom = useRoomStore((s) => s.setActiveRoom);
  const { groups, searchQuery, setSearchQuery, toggleSection } = useFilteredRooms();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <RoomSearchInput value={searchQuery} onChange={setSearchQuery} />
          <button
            onClick={() => setShowCreateDialog(true)}
            className="shrink-0 rounded-lg p-1.5 text-text-muted
                       hover:bg-bg-modifier hover:text-text-normal transition-colors"
            title="创建房间"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5">
        {groups.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-text-muted">
            {searchQuery ? "未找到匹配的房间" : "暂无房间"}
          </div>
        ) : (
          groups.map((group) => (
            <RoomSection
              key={group.key}
              label={group.label}
              rooms={group.rooms}
              collapsed={group.collapsed}
              onToggle={() => toggleSection(group.key)}
              activeRoomId={activeRoomId}
              onSelectRoom={setActiveRoom}
            />
          ))
        )}
      </div>

      {showCreateDialog && (
        <CreateRoomDialog onClose={() => setShowCreateDialog(false)} />
      )}
      {showJoinDialog && (
        <JoinRoomDialog onClose={() => setShowJoinDialog(false)} />
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
