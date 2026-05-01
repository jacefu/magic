import { useRoomStore, useUIStore } from "@magic/matrix-client";

interface ChannelHeaderProps {
  roomId: string;
}

export function ChannelHeader({ roomId }: ChannelHeaderProps) {
  const room = useRoomStore((s) => s.rooms[roomId]);
  const { rightPanelOpen, setRightPanel, closeRightPanel } = useUIStore();

  if (!room) return null;

  const toggleMembers = () => {
    if (rightPanelOpen) {
      closeRightPanel();
    } else {
      setRightPanel("members");
    }
  };

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[#1E1F22] px-3">
      {/* Channel marker */}
      <span className="text-xl text-[#949BA4]">#</span>
      <span className="text-sm font-semibold text-[#DBDEE1]">
        {room.name || "未命名房间"}
      </span>

      {/* Vertical divider + topic */}
      {room.topic && (
        <>
          <div className="mx-1.5 h-5 w-px bg-[#3F4147]" />
          <span className="flex-1 truncate text-xs text-[#949BA4]">
            {room.topic}
          </span>
        </>
      )}
      {!room.topic && <div className="flex-1" />}

      {/* Right icon cluster */}
      <div className="flex shrink-0 items-center gap-3">
        <HeaderIconButton
          title="Agent 面板"
          onClick={() => setRightPanel("agents")}
        >
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
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
        </HeaderIconButton>
        <HeaderIconButton title="搜索">
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
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </HeaderIconButton>
        <HeaderIconButton
          title="成员列表"
          isActive={rightPanelOpen}
          onClick={toggleMembers}
        >
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
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
        </HeaderIconButton>
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
      className={`text-[#949BA4] transition-colors hover:text-[#DBDEE1]
                  ${isActive ? "text-[#DBDEE1]" : ""}`}
    >
      {children}
    </button>
  );
}
