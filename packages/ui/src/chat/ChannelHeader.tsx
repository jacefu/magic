import { useRoomStore, useUIStore } from "@magic/matrix-client";

interface ChannelHeaderProps {
  roomId: string;
}

// Discord channel header (h-12, shadow-sm bottom):
//   left:  # name | topic (italic, muted)
//   right: threads / inbox / pinned / member-toggle / agent-toggle / search box
export function ChannelHeader({ roomId }: ChannelHeaderProps) {
  const room = useRoomStore((s) => s.rooms[roomId]);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const rightPanelMode = useUIStore((s) => s.rightPanelMode);
  const setRightPanel = useUIStore((s) => s.setRightPanel);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  if (!room) return null;

  const toggle = (mode: "members" | "agents") => {
    if (rightPanelOpen && rightPanelMode === mode) closeRightPanel();
    else setRightPanel(mode);
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

      {/* Right cluster */}
      <div className="flex shrink-0 items-center gap-1">
        <HeaderIconButton title="对话">
          <ThreadsIcon />
        </HeaderIconButton>
        <HeaderIconButton title="收件箱">
          <InboxIcon />
        </HeaderIconButton>
        <HeaderIconButton title="固定消息">
          <PinIcon />
        </HeaderIconButton>
        <HeaderIconButton
          title="Agent 面板"
          isActive={rightPanelOpen && rightPanelMode === "agents"}
          onClick={() => toggle("agents")}
        >
          <AgentIcon />
        </HeaderIconButton>
        <HeaderIconButton
          title="成员列表"
          isActive={rightPanelOpen && rightPanelMode === "members"}
          onClick={() => toggle("members")}
        >
          <MembersIcon />
        </HeaderIconButton>

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

function ThreadsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 7.5h13M5.5 12h13m-13 4.5h7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 16.5l3 3 5-5" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13l3-9h12l3 9M3 13v6a2 2 0 002 2h14a2 2 0 002-2v-6M3 13h5l1 2h6l1-2h5"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M16 3l5 5-3.5 3.5L19 13l-7-7 1.5 1.5L17 4l-1-1zm-3 5L8 13l-2-1-3 3 4 4 3-3-1-2 5-5-1-1z" />
    </svg>
  );
}

function AgentIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
      />
    </svg>
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
