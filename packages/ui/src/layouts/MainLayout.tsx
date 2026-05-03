import { useEffect } from "react";
import { useRoomStore, useUIStore } from "@magic/matrix-client";
import { TopNavBar } from "./TopNavBar.js";
import { WorkspaceBar } from "../workspace/WorkspaceBar.js";
import { RoomList } from "../rooms/RoomList.js";
import { UserPanel } from "../workspace/UserPanel.js";
import { ChatView } from "../chat/ChatView.js";
import { MemberPanel } from "../panels/MemberPanel.js";
import { AgentDashboard } from "../agents/AgentDashboard.js";
import { SettingsPage } from "../settings/SettingsPage.js";
import { isDmRoom } from "../lib/isDmRoom.js";

export function MainLayout() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const activeRoom = useRoomStore((s) =>
    activeRoomId ? s.rooms[activeRoomId] : null,
  );
  const { rightPanelOpen, rightPanelMode, closeRightPanel } = useUIStore();
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const closeSettings = useUIStore((s) => s.closeSettings);

  // The member panel makes no sense in a 1:1 DM (it would just show the
  // other person), and ChannelHeader hides the toggle for DMs anyway —
  // so close the panel automatically when the user switches into a DM
  // with members mode still latched open from a previous group room.
  useEffect(() => {
    if (
      rightPanelOpen &&
      rightPanelMode === "members" &&
      activeRoom &&
      isDmRoom(activeRoom)
    ) {
      closeRightPanel();
    }
  }, [activeRoom, rightPanelOpen, rightPanelMode, closeRightPanel]);

  // Cosmic AI § 4.2 — left rail + right panel are glass surfaces:
  // semi-transparent fill + backdrop-filter blur so the deep-space
  // body color (#0F0F14, set in index.css) bleeds through. Chat
  // column stays opaque so message text reads cleanly.
  const glassStyle: React.CSSProperties = {
    background: "rgba(18,18,26,0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  };
  const rightGlassStyle: React.CSSProperties = {
    background: "rgba(18,18,26,0.7)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
  };

  return (
    <div
      className="flex h-screen flex-col text-[rgba(255,255,255,0.85)]"
      style={{ background: "rgba(15,15,21,0.95)" }}
    >
      {/* Full-width title bar (drag region + global nav) */}
      <TopNavBar />

      {/* Four-column body */}
      <div className="flex min-h-0 flex-1">
        {/* Column 1: workspace bar */}
        <WorkspaceBar />

        {/* Column 2: room list + user panel */}
        <div className="flex w-[240px] shrink-0 flex-col" style={glassStyle}>
          {/* Header — workspace name dropdown + invite */}
          <div className="flex h-12 items-center justify-between border-b border-[rgba(255,255,255,0.04)] px-3">
            <button className="flex min-w-0 items-center gap-1 text-[13.5px] font-semibold text-[rgba(255,255,255,0.85)] transition-colors hover:text-white">
              <span className="truncate">Magic 工作区</span>
              <svg
                className="h-3 w-3 shrink-0 text-[rgba(255,255,255,0.4)]"
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
              className="rounded p-1 text-[rgba(255,255,255,0.4)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.85)]"
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
        <div
          className="flex min-w-0 flex-1 flex-col"
          style={{ background: "rgba(15,15,21,0.95)" }}
        >
          <ChatView />
        </div>

        {/* Column 4: contextual right panel */}
        {rightPanelOpen && activeRoomId && (
          <div
            className="flex w-[260px] shrink-0 flex-col border-l border-[rgba(255,255,255,0.04)]"
            style={rightGlassStyle}
          >
            <div className="flex h-12 items-center justify-between border-b border-[rgba(255,255,255,0.04)] px-3">
              <span className="text-[13.5px] font-semibold text-[rgba(255,255,255,0.85)]">
                {rightPanelMode === "agents" ? "Agent 面板" : "成员"}
              </span>
              <button
                onClick={closeRightPanel}
                className="rounded p-1 text-[rgba(255,255,255,0.4)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.85)]"
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

      {/* Full-screen settings overlay (spec 016) */}
      {settingsOpen && <SettingsPage onClose={closeSettings} />}
    </div>
  );
}
