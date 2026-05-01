import { memo } from "react";
import type { RoomData } from "@magic/matrix-client";
import { RoomAvatar } from "./RoomAvatar.js";
import { UnreadBadge } from "./UnreadBadge.js";

interface RoomListItemProps {
  room: RoomData;
  isActive: boolean;
  onSelect: () => void;
}

export const RoomListItem = memo(function RoomListItem({
  room,
  isActive,
  onSelect,
}: RoomListItemProps) {
  const lastMessagePreview = room.lastMessage
    ? getMessagePreview(room.lastMessage)
    : null;

  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left
                  transition-colors duration-100 ${
        isActive
          ? "bg-bg-active text-white"
          : room.unreadCount > 0
            ? "text-text-normal hover:bg-bg-hover"
            : "text-text-muted hover:bg-bg-hover hover:text-text-normal"
      }`}
    >
      <RoomAvatar
        name={room.name}
        avatarMxc={room.avatarMxc}
        isDirect={room.isDirect}
        size={36}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {room.isEncrypted && <LockIcon />}
          <span
            className={`truncate text-sm ${
              room.unreadCount > 0 ? "font-semibold text-white" : ""
            }`}
          >
            {room.name || "未命名房间"}
          </span>
        </div>
        {lastMessagePreview && (
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {lastMessagePreview}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {room.lastActivityTs > 0 && (
          <span className="text-[10px] text-text-muted">
            {formatRelativeTime(room.lastActivityTs)}
          </span>
        )}
        <UnreadBadge count={room.unreadCount} highlight={room.highlightCount > 0} />
      </div>
    </button>
  );
});

function LockIcon() {
  return (
    <svg className="h-3 w-3 shrink-0 text-green" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function getMessagePreview(event: {
  content: Record<string, unknown>;
  sender: string;
}): string {
  const content = event.content;
  const msgtype = content.msgtype as string | undefined;
  const body = content.body as string | undefined;

  if (!msgtype) return "";

  switch (msgtype) {
    case "m.text":
      return body ?? "";
    case "m.image":
      return "📷 图片";
    case "m.file":
      return "📎 文件";
    case "m.video":
      return "🎬 视频";
    case "m.audio":
      return "🎵 音频";
    default:
      return body ?? "";
  }
}

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  const date = new Date(ts);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
