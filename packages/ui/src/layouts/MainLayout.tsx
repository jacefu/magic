import { useAuthStore, useUIStore, useRoomStore } from "@magic/matrix-client";
import { useAuth } from "../hooks/useAuth.js";
import { RoomList } from "../rooms/RoomList.js";
import { ChatView } from "../chat/ChatView.js";
import { AgentDashboard } from "../agents/AgentDashboard.js";

export function MainLayout() {
  const { userId, homeserver } = useAuthStore();
  const { logout } = useAuth();
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const rightPanelMode = useUIStore((s) => s.rightPanelMode);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
  const activeRoomId = useRoomStore((s) => s.activeRoomId);

  return (
    <div className="flex h-screen bg-magic-surface text-white">
      <aside className="flex w-64 flex-col border-r border-gray-800 bg-magic-surface-alt">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <span className="text-sm font-bold tracking-wide">MAGIC</span>
        </div>

        <div className="min-h-0 flex-1">
          <RoomList />
        </div>

        <div className="border-t border-gray-800 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{userId}</p>
              <p className="truncate text-xs text-gray-500">{homeserver}</p>
            </div>
            <button
              onClick={logout}
              className="ml-2 shrink-0 rounded px-2 py-1 text-xs text-gray-400
                         hover:bg-gray-700 hover:text-white transition-colors"
            >
              登出
            </button>
          </div>
        </div>
      </aside>

      <ChatView />

      {rightPanelOpen && activeRoomId && (
        <aside className="flex w-80 flex-col border-l border-gray-800 bg-magic-surface-alt">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <span className="text-sm font-semibold text-white">
              {rightPanelMode === "agents" ? "Agent 面板" : rightPanelMode}
            </span>
            <button
              onClick={closeRightPanel}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-white"
              title="关闭"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {rightPanelMode === "agents" && <AgentDashboard roomId={activeRoomId} />}
          </div>
        </aside>
      )}
    </div>
  );
}
