import { useRoomStore, useUIStore } from "@magic/matrix-client";
import { WorkspaceBar } from "../workspace/WorkspaceBar.js";
import { RoomList } from "../rooms/RoomList.js";
import { UserPanel } from "../workspace/UserPanel.js";
import { ChatView } from "../chat/ChatView.js";
import { MemberPanel } from "../panels/MemberPanel.js";
import { AgentDashboard } from "../agents/AgentDashboard.js";

export function MainLayout() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const { rightPanelOpen, rightPanelMode, closeRightPanel } = useUIStore();

  return (
    <div className="flex h-screen bg-[#313338] text-[#DBDEE1]">
      {/* Column 1: workspace bar */}
      <WorkspaceBar />

      {/* Column 2: room list + user panel */}
      <div className="flex w-[200px] shrink-0 flex-col bg-[#2B2D31]">
        {/* Header */}
        <div className="flex h-10 items-center border-b border-[#1E1F22] px-3">
          <span className="text-[13px] font-semibold text-[#DBDEE1]">
            Magic 工作区
          </span>
        </div>

        {/* Room list */}
        <div className="min-h-0 flex-1">
          <RoomList />
        </div>

        {/* User panel */}
        <UserPanel />
      </div>

      {/* Column 3: chat */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#313338]">
        <ChatView />
      </div>

      {/* Column 4: contextual right panel */}
      {rightPanelOpen && activeRoomId && (
        <div className="flex w-[200px] shrink-0 flex-col border-l border-[#1E1F22] bg-[#2B2D31]">
          {/* Panel header */}
          <div className="flex h-10 items-center justify-between border-b border-[#1E1F22] px-3">
            <span className="text-[13px] font-semibold text-[#DBDEE1]">
              {rightPanelMode === "agents" ? "Agent 面板" : "成员"}
            </span>
            <button
              onClick={closeRightPanel}
              className="rounded p-0.5 text-[#949BA4] hover:text-[#DBDEE1]"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Panel content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rightPanelMode === "members" && <MemberPanel roomId={activeRoomId} />}
            {rightPanelMode === "agents" && <AgentDashboard roomId={activeRoomId} />}
          </div>
        </div>
      )}
    </div>
  );
}
