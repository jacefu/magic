import { useRoomStore, useUIStore } from "@magic/matrix-client";
import { TopNavBar } from "./TopNavBar.js";
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
    <div className="flex h-screen flex-col bg-[#313338] text-[#DBDEE1]">
      {/* Full-width title bar (drag region + global nav) */}
      <TopNavBar />

      {/* Four-column body */}
      <div className="flex min-h-0 flex-1">
        {/* Column 1: workspace bar */}
        <WorkspaceBar />

        {/* Column 2: room list + user panel */}
        <div className="flex w-[240px] shrink-0 flex-col bg-[#2B2D31]">
          {/* Header — workspace name dropdown + invite */}
          <div className="flex h-12 items-center justify-between border-b border-[#1E1F22] px-3 shadow-sm">
            <button className="flex min-w-0 items-center gap-1 text-[15px] font-semibold text-[#DBDEE1] transition-colors hover:text-white">
              <span className="truncate">Magic 工作区</span>
              <svg
                className="h-3 w-3 shrink-0 text-[#949BA4]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              title="邀请成员"
              className="rounded p-1 text-[#949BA4] transition-colors hover:bg-[#35373C] hover:text-[#DBDEE1]"
            >
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
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <RoomList />
          </div>

          <UserPanel />
        </div>

        {/* Column 3: chat */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#313338]">
          <ChatView />
        </div>

        {/* Column 4: contextual right panel */}
        {rightPanelOpen && activeRoomId && (
          <div className="flex w-[260px] shrink-0 flex-col border-l border-[#1E1F22] bg-[#2B2D31]">
            <div className="flex h-12 items-center justify-between border-b border-[#1E1F22] px-3 shadow-sm">
              <span className="text-[15px] font-semibold text-[#DBDEE1]">
                {rightPanelMode === "agents" ? "Agent 面板" : "成员"}
              </span>
              <button
                onClick={closeRightPanel}
                className="rounded p-1 text-[#949BA4] transition-colors hover:bg-[#35373C] hover:text-[#DBDEE1]"
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
    </div>
  );
}
