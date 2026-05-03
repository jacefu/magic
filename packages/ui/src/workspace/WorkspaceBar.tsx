import { useMemo, useState } from "react";
import {
  switchSession,
  useSessionStore,
  useUIStore,
} from "@magic/matrix-client";
import { WorkspaceIcon } from "./WorkspaceIcon.js";
import { AddServerDialog } from "./AddServerDialog.js";

/**
 * Spec 016: each workspace icon = one logged-in Matrix homeserver.
 * Layout (top → bottom):
 *
 *   [ Magic logo ]   ← settings entry (always at the top)
 *   ─────────────
 *   [ session 1 ]
 *   [ session 2 ]    ← per-server, sorted by addedAt
 *   …
 *   ─────────────
 *   [    +     ]    ← AddServerDialog
 */
export function WorkspaceBar() {
  // Subscribe to the raw record and sort in a useMemo so the array
  // reference stays stable when the underlying sessions don't change —
  // returning a new sorted array directly from a Zustand selector
  // triggers an infinite render loop.
  const sessionsRecord = useSessionStore((s) => s.sessions);
  const sessions = useMemo(
    () =>
      Object.values(sessionsRecord).sort((a, b) => a.addedAt - b.addedAt),
    [sessionsRecord],
  );
  const activeId = useSessionStore((s) => s.activeSessionId);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const openSettings = useUIStore((s) => s.openSettings);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-[#1E1F22] pb-3 pt-0">
      {/* Magic brand mark — opens the settings overlay. Always at the
          top of the rail. Highlighted with the same selection
          indicator as session icons when settings is open. */}
      <MagicBrandIcon active={settingsOpen} onClick={openSettings} />

      <div className="mx-auto h-0.5 w-7 rounded-full bg-[#3F4147]" />

      {sessions.map((session) => (
        <WorkspaceIcon
          key={session.id}
          initial={session.serverInitial}
          name={session.serverName}
          color={session.serverColor ?? undefined}
          isActive={!settingsOpen && session.id === activeId}
          hasNotification={session.unreadCount > 0}
          notificationCount={
            session.id === activeId ? undefined : session.unreadCount
          }
          syncState={session.syncState}
          initialSyncComplete={session.initialSyncComplete}
          onClick={() => switchSession(session.id)}
        />
      ))}

      {sessions.length > 0 && (
        <div className="mx-auto h-0.5 w-7 rounded-full bg-[#3F4147]" />
      )}

      <WorkspaceIcon
        initial="+"
        name="添加 Matrix 服务器"
        variant="add"
        onClick={() => setShowAdd(true)}
      />

      {showAdd && <AddServerDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}

/** Magic brand icon at the top of the workspace rail. */
function MagicBrandIcon({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative flex items-center pt-2">
      {active && (
        <span className="absolute -left-3 h-5 w-1 rounded-r-full bg-white" />
      )}
      <button
        type="button"
        onClick={onClick}
        title="Magic 设置"
        className="flex h-12 w-12 items-center justify-center rounded-2xl
                   bg-[#5865F2] text-white transition-colors hover:bg-[#4752C4]"
      >
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          {/* Sparkle/star — the brand mark used on the WelcomePage too. */}
          <path d="M12 2.5l2.4 5.4 5.6 1-4 4.1.9 5.5L12 16l-4.9 2.5.9-5.5-4-4.1 5.6-1L12 2.5z" />
        </svg>
      </button>
    </div>
  );
}
