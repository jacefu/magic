import { memo } from "react";
import type { SerializedMatrixEvent } from "@magic/shared-types";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import { MessageContent } from "./MessageContent.js";

interface MessageBubbleProps {
  event: SerializedMatrixEvent;
  showSender: boolean;
  isOwn: boolean;
  onReply?: (eventId: string) => void;
}

export const MessageBubble = memo(function MessageBubble({
  event,
  showSender,
  isOwn,
  onReply,
}: MessageBubbleProps) {
  const isMessage = event.type === "m.room.message" || event.type === "m.room.encrypted";
  if (!isMessage) {
    return <SystemEventLine event={event} />;
  }

  const time = formatTime(event.timestamp);
  const senderName = extractDisplayName(event.sender);

  return (
    <div
      className={`group flex gap-2.5 px-4 ${showSender ? "mt-3" : "mt-0.5"} ${
        isOwn ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <div className="w-8 shrink-0">
        {showSender && !isOwn && (
          <RoomAvatar name={senderName} avatarMxc={null} isDirect={true} size={32} />
        )}
      </div>

      <div className={`relative max-w-[70%] min-w-0 ${isOwn ? "items-end" : "items-start"}`}>
        {onReply && (
          <div
            className={`absolute -top-3 ${isOwn ? "left-0" : "right-0"}
                        hidden items-center gap-0.5 rounded-lg border border-gray-700
                        bg-magic-surface-alt px-1 py-0.5 shadow-lg group-hover:flex`}
          >
            <button
              onClick={() => onReply(event.eventId)}
              className="rounded p-0.5 text-gray-400 transition-colors
                         hover:bg-gray-700 hover:text-white"
              title="回复"
            >
              <ReplyIcon />
            </button>
          </div>
        )}

        {showSender && !isOwn && (
          <p className="mb-0.5 text-xs font-medium text-gray-400">{senderName}</p>
        )}

        <div
          className={`inline-block rounded-2xl px-3 py-2 text-sm leading-relaxed ${
            isOwn
              ? "rounded-br-md bg-magic-primary text-white"
              : "rounded-bl-md bg-magic-surface-alt text-gray-100"
          }`}
        >
          <MessageContent event={event} isOwn={isOwn} />
        </div>

        <p
          className={`mt-0.5 text-[10px] text-gray-500 ${
            isOwn ? "text-right" : "text-left"
          }`}
        >
          {time}
        </p>
      </div>
    </div>
  );
});

function ReplyIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
      />
    </svg>
  );
}

function SystemEventLine({ event }: { event: SerializedMatrixEvent }) {
  const text = getSystemEventText(event);
  if (!text) return null;

  return (
    <div className="flex justify-center px-4 py-2">
      <span className="rounded-full bg-gray-800/50 px-3 py-1 text-xs text-gray-500">
        {text}
      </span>
    </div>
  );
}

function getSystemEventText(event: SerializedMatrixEvent): string | null {
  const sender = extractDisplayName(event.sender);

  switch (event.type) {
    case "m.room.member": {
      const membership = event.content.membership as string;
      if (membership === "join") return `${sender} 加入了房间`;
      if (membership === "leave") return `${sender} 离开了房间`;
      if (membership === "invite") return `${sender} 被邀请加入`;
      return null;
    }
    case "m.room.topic":
      return `${sender} 更新了房间话题`;
    case "m.room.name":
      return `${sender} 更新了房间名称为「${event.content.name as string}」`;
    case "m.room.encryption":
      return "已启用端到端加密";
    default:
      return null;
  }
}

function extractDisplayName(userId: string): string {
  const match = userId.match(/^@([^:]+)/);
  return match ? match[1] : userId;
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
