import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInviteStore,
  useRoomStore,
  useSessionStore,
  type RoomInvite,
} from "@magic/matrix-client";
import { useFilteredRooms } from "../hooks/useFilteredRooms.js";
import { RoomSection } from "./RoomSection.js";
import { CreateRoomDialog } from "./CreateRoomDialog.js";
import { JoinRoomDialog } from "./JoinRoomDialog.js";
import { StartDMDialog } from "./StartDMDialog.js";
import { InviteSection } from "./InviteSection.js";
import { InviteDialog } from "../invites/InviteDialog.js";

export function RoomList() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const setActiveRoom = useRoomStore((s) => s.setActiveRoom);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const { groups, searchQuery, setSearchQuery, toggleSection } =
    useFilteredRooms();

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
      {/* Search input + standalone "+" button. The previous design
          required a click to reveal the search input; the inline
          input is more discoverable and matches Discord/Slack
          conventions. */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索房间/Agent/用户"
            className="w-full rounded-md py-1.5 pl-7 pr-2 text-xs outline-none
                       transition-colors focus:border-[var(--border-active)]"
            style={{
              background: "var(--bg-surface)",
              border: "0.5px solid var(--border-default)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="relative" ref={plusMenuRef}>
          <button
            type="button"
            onClick={() => setShowPlusMenu((v) => !v)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md
                       transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            style={{
              color: "var(--text-secondary)",
              background: showPlusMenu ? "var(--bg-surface)" : "transparent",
            }}
            title="创建房间 / 发起私聊"
            aria-label="新建"
          >
            <PlusIcon />
          </button>

          {showPlusMenu && (
            <div
              className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg py-1 shadow-xl"
              style={{
                background: "var(--bg-primary)",
                border: "0.5px solid var(--border-default)",
                animation: "fade-in-up 0.15s ease-out",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowPlusMenu(false);
                  setShowCreateDialog(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors
                           hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-primary)" }}
              >
                <span style={{ color: "var(--text-tertiary)" }}>#</span>
                创建房间
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPlusMenu(false);
                  setShowDMDialog(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors
                           hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-primary)" }}
              >
                <span style={{ color: "var(--text-tertiary)" }}>@</span>
                发起私聊
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
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
