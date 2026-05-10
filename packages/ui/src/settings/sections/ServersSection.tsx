import {
  removeServer,
  switchSession,
  useSessionStore,
  useUIStore,
} from "@magic/matrix-client";
import { useMemo, useState } from "react";
import { AddServerDialog } from "../../workspace/AddServerDialog.js";

export function ServersSection() {
  // Sort in useMemo (not via a Zustand getter) — returning a fresh
  // sorted array from a Zustand selector each call triggers an
  // infinite render loop because the reference is never stable.
  const sessionsRecord = useSessionStore((s) => s.sessions);
  const sessions = useMemo(
    () =>
      Object.values(sessionsRecord).sort((a, b) => a.addedAt - b.addedAt),
    [sessionsRecord],
  );
  const activeId = useSessionStore((s) => s.activeSessionId);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const [showAdd, setShowAdd] = useState(false);

  const handleRemove = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const ok = window.confirm(
      `确定要断开 ${session.serverName}（${session.homeserver}）吗？\n断开后需要重新登录才能恢复。`,
    );
    if (!ok) return;
    await removeServer(sessionId);
    // Close the settings overlay so the user lands cleanly on the
    // welcome page (when this was the last session) or on the chat
    // view of whichever server is now active. Without this, the
    // overlay stayed mounted and partially obscured the new state,
    // making the disconnect feel like a no-op.
    if (Object.keys(useSessionStore.getState().sessions).length === 0) {
      closeSettings();
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[var(--text-secondary)]">
          你已登录 {sessions.length} 个 Matrix 服务器。每个服务器在左侧栏显示为独立的工作区图标。
        </p>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white
                     transition-opacity hover:opacity-90"
          style={{
            background: "var(--gradient-button)",
          }}
        >
          + 添加服务器
        </button>
      </div>

      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
              session.id === activeId
                ? "border border-[var(--border-active)] bg-[var(--bg-surface)]"
                : "bg-[var(--bg-glass)]"
            }`}
          >
            <button
              type="button"
              onClick={() => switchSession(session.id)}
              title={`切换到 ${session.serverName}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white transition-transform hover:scale-105"
              style={{ backgroundColor: session.serverColor ?? "#5865F2" }}
            >
              {session.serverInitial}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {session.serverName}
                </p>
                {session.id === activeId && (
                  <span className="shrink-0 rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-purple)]">
                    当前
                  </span>
                )}
                <SyncBadge state={session.syncState} />
              </div>
              <p className="truncate text-xs text-[var(--text-tertiary)]">{session.userId}</p>
              <p className="truncate text-xs text-[var(--text-tertiary)]">
                {session.homeserver}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleRemove(session.id)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-[var(--color-danger)]
                         transition-colors hover:bg-[var(--color-danger)]/10"
            >
              断开
            </button>
          </div>
        ))}
      </div>

      {showAdd && <AddServerDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function SyncBadge({ state }: { state: string }) {
  if (state === "PREPARED")
    return <span className="text-[10px] text-[var(--color-success)]">● 已连接</span>;
  if (state === "SYNCING")
    return <span className="text-[10px] text-[var(--color-warning)]">● 同步中</span>;
  if (state === "ERROR")
    return <span className="text-[10px] text-[var(--color-danger)]">● 连接错误</span>;
  if (state === "RECONNECTING")
    return <span className="text-[10px] text-[var(--color-warning)]">● 重连中</span>;
  return <span className="text-[10px] text-[var(--text-tertiary)]">● 已断开</span>;
}
