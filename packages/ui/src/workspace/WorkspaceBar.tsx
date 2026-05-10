import { useMemo, useState } from "react";
import {
  switchSession,
  useSessionStore,
  useUIStore,
} from "@magic/matrix-client";
import { WorkspaceIcon } from "./WorkspaceIcon.js";
import { AddServerDialog } from "./AddServerDialog.js";
import { MagicAppIcon } from "../branding/MagicAppIcon.js";

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
    <div
      className="flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto pb-3 pt-0"
      style={{ background: "var(--bg-deepest)" }}
    >
      {/* Magic brand mark — opens the settings overlay. Always at the
          top of the rail. Highlighted with the same selection
          indicator as session icons when settings is open. */}
      <MagicBrandIcon active={settingsOpen} onClick={openSettings} />

      <span
        aria-hidden="true"
        className="mx-auto h-px w-7"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--border-hover), transparent)",
        }}
      />

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
        <span
          aria-hidden="true"
          className="mx-auto h-px w-7"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--border-hover), transparent)",
          }}
        />
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

/** Magic brand icon at the top of the workspace rail. Spec 023 §7.4
 *  swaps the legacy gradient sparkle for the user-supplied
 *  MagicAppIcon, which auto-flips light/dark with the theme. The
 *  selection indicator (left edge bar) survives so the rail still
 *  signals "settings is open". */
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
        <span
          aria-hidden="true"
          className="absolute -left-3 h-[18px] w-[3px] rounded-r-[3px]"
          style={{ background: "linear-gradient(180deg, #6C5CE7, #00B4D8)" }}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        title="Magic 设置"
        className="flex h-11 w-11 items-center justify-center rounded-[14px]
                   transition-opacity hover:opacity-90"
      >
        <MagicAppIcon size={36} />
      </button>
    </div>
  );
}
