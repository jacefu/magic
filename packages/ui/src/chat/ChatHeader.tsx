import { useRoomStore, useUIStore } from "@magic/matrix-client";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import { EncryptionBadge } from "../crypto/EncryptionBadge.js";
import { useEncryptionStatus } from "../hooks/useEncryptionStatus.js";
import { isDmRoom } from "../lib/isDmRoom.js";

interface ChatHeaderProps {
  roomId: string;
}

export function ChatHeader({ roomId }: ChatHeaderProps) {
  const room = useRoomStore((s) => s.rooms[roomId]);
  const { status } = useEncryptionStatus(roomId);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const rightPanelMode = useUIStore((s) => s.rightPanelMode);
  const setRightPanel = useUIStore((s) => s.setRightPanel);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);

  if (!room) return null;

  const agentsActive = rightPanelOpen && rightPanelMode === "agents";

  const toggleAgents = () => {
    if (agentsActive) closeRightPanel();
    else setRightPanel("agents");
  };

  return (
    <div className="flex items-center gap-3 border-b border-divider-light px-4 py-3">
      <RoomAvatar
        name={room.name}
        avatarMxc={room.avatarMxc}
        isDirect={isDmRoom(room)}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <EncryptionBadge status={status} />
          <h2 className="truncate text-sm font-semibold text-text-normal">
            {room.name || "未命名房间"}
          </h2>
        </div>
        <p className="truncate text-xs text-text-muted">
          {room.memberCount} 位成员
          {room.topic ? ` · ${room.topic}` : ""}
        </p>
      </div>

      <button
        onClick={toggleAgents}
        className={`shrink-0 rounded p-1.5 transition-colors ${
          agentsActive
            ? "bg-brand/20 text-brand"
            : "text-text-muted hover:bg-bg-secondary hover:text-text-normal"
        }`}
        title="Agent 面板"
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
            d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
          />
        </svg>
      </button>
    </div>
  );
}
