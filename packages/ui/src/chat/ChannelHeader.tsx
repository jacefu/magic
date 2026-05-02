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

  if (!room) return null;

  const isDm = isDmRoom(room);

  const toggleMembers = () => {
    if (rightPanelOpen && rightPanelMode === "members") closeRightPanel();
    else setRightPanel("members");
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[#1E1F22] bg-[#313338] px-4 shadow-sm">
      {/* Channel marker + name */}
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-[20px] leading-none text-[#949BA4]">#</span>
        <span className="text-[16px] font-semibold text-white">
          {room.name || "未命名房间"}
        </span>
      </div>

      {/* Topic (with vertical divider) */}
      {room.topic ? (
        <>
          <div className="h-6 w-px bg-[#3F4147]" />
          <span className="min-w-0 flex-1 truncate text-[14px] text-[#B5BAC1]">
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

        {/* Search box (visual only — Cmd+K could later wire it up) */}
        <div className="ml-1 flex h-6 w-36 items-center rounded bg-[#1E1F22] px-1.5">
          <input
            type="text"
            placeholder={`搜索 ${room.name || "房间"}`}
            className="w-full bg-transparent text-[12px] text-[#DBDEE1]
                       placeholder:text-[#6D6F78] outline-none"
          />
          <SmallSearchIcon />
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
                      ? "bg-[#404249] text-[#DBDEE1]"
                      : "text-[#B5BAC1] hover:bg-[#35373C] hover:text-[#DBDEE1]"
                  }`}
    >
      {children}
    </button>
  );
}

function MembersIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 8.5a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm-2 6.5c-3.866 0-7 1.79-7 4v2h14v-2c0-2.21-3.134-4-7-4zm6.5-9.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm5 11.5c0-1.75-2.5-3.25-5-3.25-.5 0-1 .05-1.5.15.95.85 1.5 1.95 1.5 3.1V19h5v-2.5z" />
    </svg>
  );
}

function SmallSearchIcon() {
  return (
    <svg className="h-3 w-3 shrink-0 text-[#6D6F78]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}
