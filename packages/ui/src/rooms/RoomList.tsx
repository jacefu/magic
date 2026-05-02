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
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="px-2 pt-2">
        <button
          onClick={() => setShowSearch((v) => !v)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left
                     text-[13px] font-medium text-[#949BA4]
                     transition-colors hover:bg-[#35373C] hover:text-[#DBDEE1]"
          title="搜索房间"
        >
          <SearchIcon />
          <span>搜索房间</span>
          <span className="ml-auto shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCreateDialog(true);
              }}
              className="rounded p-0.5 text-[#949BA4] hover:text-[#DBDEE1]"
              title="创建房间"
              aria-label="创建房间"
            >
              <PlusIcon />
            </button>
          </span>
        </button>

        {showSearch && (
          <div className="mt-1">
            <RoomSearchInput value={searchQuery} onChange={setSearchQuery} />
          </div>
        )}
      </div>

      <div className="mt-1 flex-1 overflow-y-auto pb-2">
        {groups.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-[#949BA4]">
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

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
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
