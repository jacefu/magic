import { useRoomStore } from "@magic/matrix-client";
import { RoomAvatar } from "../rooms/RoomAvatar.js";

interface ChatHeaderProps {
  roomId: string;
}

export function ChatHeader({ roomId }: ChatHeaderProps) {
  const room = useRoomStore((s) => s.rooms[roomId]);
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
          {room.isEncrypted && (
            <svg
              className="h-3 w-3 shrink-0 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
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
