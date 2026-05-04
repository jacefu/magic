import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInviteStore,
  useRoomStore,
  useSessionStore,
  type RoomInvite,
} from "@magic/matrix-client";
import { useFilteredRooms } from "../hooks/useFilteredRooms.js";
import { RoomSection } from "./RoomSection.js";
import { RoomSearchInput } from "./RoomSearchInput.js";
import { CreateRoomDialog } from "./CreateRoomDialog.js";
import { JoinRoomDialog } from "./JoinRoomDialog.js";
import { StartDMDialog } from "./StartDMDialog.js";
import { InviteSection } from "./InviteSection.js";
import { InviteDialog } from "../invites/InviteDialog.js";

export function RoomList() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const setActiveRoom = useRoomStore((s) => s.setActiveRoom);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const { groups, searchQuery, setSearchQuery, toggleSection } = useFilteredRooms();

  // Subscribe to the raw invites map and filter in a memo so the
  // selector doesn't return a fresh array on every store write
  // (which would re-trigger Zustand's strict-equality comparator).
  const invitesMap = useInviteStore((s) => s.invites);
  const invites = useMemo<RoomInvite[]>(() => {
    if (!activeSessionId) return [];
    return Object.values(invitesMap)
      .filter((inv) => inv.sessionId === activeSessionId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [invitesMap, activeSessionId]);

  const [selectedInvite, setSelectedInvite] = useState<RoomInvite | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showDMDialog, setShowDMDialog] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);

  // Close the +-button dropdown when the user clicks outside it.
  const plusMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showPlusMenu) return;
    const onDown = (e: MouseEvent) => {
      if (!plusMenuRef.current?.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [showPlusMenu]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-2 pt-2">
        <button
          onClick={() => setShowSearch((v) => !v)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left
                     text-[13px] font-medium text-[var(--text-secondary)]
                     transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
          title="搜索房间"
        >
          <SearchIcon />
          <span>搜索房间</span>
          <span className="relative ml-auto shrink-0" ref={plusMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPlusMenu((v) => !v);
              }}
              className="rounded p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title="新建"
              aria-label="新建"
            >
              <PlusIcon />
            </button>

            {showPlusMenu && (
              <div
                className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-lg shadow-xl"
                style={{
                  background: "var(--bg-primary)",
                  border: "0.5px solid var(--border-default)",
                  animation: "fade-in-up 0.15s ease-out",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowPlusMenu(false);
                    setShowCreateDialog(true);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs transition-colors
                             hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-primary)" }}
                >
                  创建房间
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPlusMenu(false);
                    setShowDMDialog(true);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs transition-colors
                             hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-primary)" }}
                >
                  发起私聊
                </button>
              </div>
            )}
          </span>
        </button>

        {showSearch && (
          <div className="mt-1">
            <RoomSearchInput value={searchQuery} onChange={setSearchQuery} />
          </div>
        )}
      </div>

      <div className="mt-1 flex-1 overflow-y-auto pb-2">
        <InviteSection
          invites={invites}
          onSelectInvite={(inv) => setSelectedInvite(inv)}
        />

        {groups.length === 0 && invites.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-[var(--text-secondary)]">
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

      {selectedInvite && (
        <InviteDialog
          invite={selectedInvite}
          onClose={() => setSelectedInvite(null)}
        />
      )}
      {showCreateDialog && (
        <CreateRoomDialog onClose={() => setShowCreateDialog(false)} />
      )}
      {showJoinDialog && (
        <JoinRoomDialog onClose={() => setShowJoinDialog(false)} />
      )}
      {showDMDialog && (
        <StartDMDialog onClose={() => setShowDMDialog(false)} />
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
