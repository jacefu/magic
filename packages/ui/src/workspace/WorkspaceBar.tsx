import { useState } from "react";
import { switchSession, useSessionStore } from "@magic/matrix-client";
import { WorkspaceIcon } from "./WorkspaceIcon.js";
import { AddServerDialog } from "./AddServerDialog.js";

/**
 * Spec 016: each workspace icon = one logged-in Matrix homeserver. The
 * "+" button at the bottom opens AddServerDialog to add another one.
 *
 * Order: stable by `addedAt` (set in session-manager.addServer).
 */
export function WorkspaceBar() {
  const sessions = useSessionStore((s) => s.getSessionList());
  const activeId = useSessionStore((s) => s.activeSessionId);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-[#1E1F22] pb-3 pt-0">
      {sessions.map((session) => (
        <WorkspaceIcon
          key={session.id}
          initial={session.serverInitial}
          name={session.serverName}
          color={session.serverColor ?? undefined}
          isActive={session.id === activeId}
          hasNotification={session.unreadCount > 0}
          notificationCount={
            session.id === activeId ? undefined : session.unreadCount
          }
          syncState={session.syncState}
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
