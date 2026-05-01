import { useRoomStore, useUIStore } from "@magic/matrix-client";
import { WorkspaceBar } from "../workspace/WorkspaceBar.js";
import { UserPanel } from "../workspace/UserPanel.js";
import { RoomList } from "../rooms/RoomList.js";
import { ChatView } from "../chat/ChatView.js";
import { MemberPanel } from "../panels/MemberPanel.js";
import { AgentDashboard } from "../agents/AgentDashboard.js";

export function MainLayout() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const rightPanelMode = useUIStore((s) => s.rightPanelMode);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  const showRightPanel = rightPanelOpen && activeRoomId;

  return (
    <div className="flex h-screen bg-bg-primary text-text-normal">
      {/* Column 1: workspace bar */}
      <WorkspaceBar />

      {/* Column 2: rooms list + user panel */}
      <div className="flex w-[200px] shrink-0 flex-col bg-bg-secondary">
        <div className="flex h-10 items-center border-b border-bg-tertiary px-3">
          <span className="text-[13px] font-semibold text-text-normal">
            Magic 工作区
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <RoomList />
        </div>
        <UserPanel />
      </div>

      {/* Column 3: chat */}
      <div className="flex min-w-0 flex-1 flex-col bg-bg-primary">
        <ChatView />
      </div>

      {/* Column 4: contextual right panel (members / agents) */}
      {showRightPanel && (
        <div className="flex w-[260px] shrink-0 flex-col border-l border-bg-tertiary bg-bg-secondary">
          <div className="flex h-10 items-center justify-between border-b border-bg-tertiary px-3">
            <span className="text-[13px] font-semibold text-text-normal">
              {rightPanelMode === "agents" ? "Agent 面板" : "成员"}
            </span>
            <button
              onClick={closeRightPanel}
              className="rounded p-0.5 text-text-muted hover:text-text-normal"
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
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rightPanelMode === "members" && <MemberPanel roomId={activeRoomId} />}
            {rightPanelMode === "agents" && <AgentDashboard roomId={activeRoomId} />}
          </div>
        </div>
      )}
    </div>
  );
}
