import {
  removeServer,
  switchSession,
  useSessionStore,
} from "@magic/matrix-client";
import { useState } from "react";
import { AddServerDialog } from "../../workspace/AddServerDialog.js";

export function ServersSection() {
  const sessions = useSessionStore((s) => s.getSessionList());
  const activeId = useSessionStore((s) => s.activeSessionId);
  const [showAdd, setShowAdd] = useState(false);

  const handleRemove = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const ok = window.confirm(
      `确定要断开 ${session.serverName}（${session.homeserver}）吗？\n断开后需要重新登录才能恢复。`,
    );
    if (ok) await removeServer(sessionId);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[#949BA4]">
          你已登录 {sessions.length} 个 Matrix 服务器。每个服务器在左侧栏显示为独立的工作区图标。
        </p>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="shrink-0 rounded-md bg-[#5865F2] px-3 py-1.5 text-xs font-medium text-white
                     transition-colors hover:bg-[#4752C4]"
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
                ? "border border-[#5865F2]/30 bg-[#5865F2]/10"
                : "bg-[#2B2D31]"
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
                <p className="truncate text-sm font-semibold text-[#DBDEE1]">
                  {session.serverName}
                </p>
                {session.id === activeId && (
                  <span className="shrink-0 rounded bg-[#5865F2]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#5865F2]">
                    当前
                  </span>
                )}
                <SyncBadge state={session.syncState} />
              </div>
              <p className="truncate text-xs text-[#6D6F78]">{session.userId}</p>
              <p className="truncate text-xs text-[#6D6F78]">
                {session.homeserver}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleRemove(session.id)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-[#F23F43]
                         transition-colors hover:bg-[#F23F43]/10"
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
    return <span className="text-[10px] text-[#23A55A]">● 已连接</span>;
  if (state === "SYNCING")
    return <span className="text-[10px] text-[#F0B232]">● 同步中</span>;
  if (state === "ERROR")
    return <span className="text-[10px] text-[#F23F43]">● 连接错误</span>;
  if (state === "RECONNECTING")
    return <span className="text-[10px] text-[#F0B232]">● 重连中</span>;
  return <span className="text-[10px] text-[#6D6F78]">● 已断开</span>;
}
