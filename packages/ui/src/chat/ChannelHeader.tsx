import { useState } from "react";
import { useRoomStore, useUIStore } from "@magic/matrix-client";
import { isDmRoom } from "../lib/isDmRoom.js";

interface ChannelHeaderProps {
  roomId: string;
}

// Channel header (h-12, shadow-sm bottom):
//   left:  # name | topic
//   right: members toggle (group rooms only) | search box
export function ChannelHeader({ roomId }: ChannelHeaderProps) {
  const room = useRoomStore((s) => s.rooms[roomId]);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const rightPanelMode = useUIStore((s) => s.rightPanelMode);
  const setRightPanel = useUIStore((s) => s.setRightPanel);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  // Header-search input is wired UI-only for now: backend message
  // search isn't built yet. Surface a "即将上线" hint as soon as
  // the user starts typing so there's no silent dead end.
  const [searchValue, setSearchValue] = useState("");

  if (!room) return null;

  const isDm = isDmRoom(room);

  const toggleMembers = () => {
    if (rightPanelOpen && rightPanelMode === "members") closeRightPanel();
    else setRightPanel("members");
  };

  const toggleSettings = () => {
    if (rightPanelOpen && rightPanelMode === "settings") closeRightPanel();
    else setRightPanel("settings");
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--border-default)] bg-[var(--bg-primary)] px-4 shadow-sm">
      {/* Channel marker + name */}
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-[20px] leading-none text-[var(--text-secondary)]">#</span>
        <span className="text-[16px] font-semibold text-[var(--text-primary)]">
          {room.name || "未命名房间"}
        </span>
      </div>

      {/* Topic (with vertical divider) */}
      {room.topic ? (
        <>
          <div className="h-6 w-px bg-[var(--border-hover)]" />
          <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--text-secondary)]">
            {room.topic}
          </span>
        </>
      ) : (
        <div className="flex-1" />
      )}

      {/* Right cluster — DMs hide the member toggle since there's just
          two of you and the panel adds nothing. */}
      <div className="flex shrink-0 items-center gap-1">
        {!isDm && (
          <HeaderIconButton
            title="成员列表"
            isActive={rightPanelOpen && rightPanelMode === "members"}
            onClick={toggleMembers}
          >
            <MembersIcon />
          </HeaderIconButton>
        )}

        {/* Spec 021 — settings panel toggle. Both group rooms and
            DMs get this button; the panel itself routes to a
            DM-specific layout when isDirect is true. */}
        <HeaderIconButton
          title="房间设置"
          isActive={rightPanelOpen && rightPanelMode === "settings"}
          onClick={toggleSettings}
        >
          <SettingsIcon />
        </HeaderIconButton>

        {/* Header search — UI-only placeholder for in-room message
            search. Visible border + leading icon so it reads as an
            input field instead of dead space. */}
        <div
          className="relative ml-1 flex h-7 w-44 items-center rounded-md px-1.5"
          style={{
            background: "var(--bg-surface)",
            border: "0.5px solid var(--border-hover)",
          }}
          title="消息搜索功能即将上线"
        >
          <SmallSearchIcon />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={`搜索 ${room.name || "房间"}`}
            className="ml-1.5 w-full bg-transparent text-[12px] text-[var(--text-secondary)]
                       placeholder:text-[var(--text-tertiary)] outline-none
                       focus:text-[var(--text-primary)]"
          />

          {searchValue && (
            <div
              className="absolute right-0 top-full z-10 mt-1 w-44 rounded-md px-2.5 py-1.5 text-[11px] shadow-lg"
              style={{
                background: "var(--bg-primary)",
                border: "0.5px solid var(--border-default)",
                color: "var(--text-secondary)",
              }}
            >
              消息搜索功能即将上线
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeaderIconButton({
  children,
  title,
  isActive,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded transition-colors
                  ${
                    isActive
                      ? "bg-[var(--ws-icon-bg)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                  }`}
    >
      {children}
    </button>
  );
}

function MembersIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function SmallSearchIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}
