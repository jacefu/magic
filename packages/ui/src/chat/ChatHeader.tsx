import { useRoomStore } from "@magic/matrix-client";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import { EncryptionBadge } from "../crypto/EncryptionBadge.js";
import { useEncryptionStatus } from "../hooks/useEncryptionStatus.js";

interface ChatHeaderProps {
  roomId: string;
}

export function ChatHeader({ roomId }: ChatHeaderProps) {
  const room = useRoomStore((s) => s.rooms[roomId]);
  const { status } = useEncryptionStatus(roomId);
  if (!room) return null;

  return (
    <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-3">
      <RoomAvatar
        name={room.name}
        avatarMxc={room.avatarMxc}
        isDirect={room.isDirect}
        size={32}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <EncryptionBadge status={status} />
          <h2 className="truncate text-sm font-semibold text-white">
            {room.name || "未命名房间"}
          </h2>
        </div>
        <p className="truncate text-xs text-gray-500">
          {room.memberCount} 位成员
          {room.topic ? ` · ${room.topic}` : ""}
        </p>
      </div>
    </div>
  );
}
