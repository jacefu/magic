import { memo } from "react";
import type { SerializedMatrixEvent } from "@magic/shared-types";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import { MessageContent } from "./MessageContent.js";
import { AgentTag } from "../agents/AgentTag.js";
import { getAgentInfo } from "../lib/agentDetection.js";

interface MessageBubbleProps {
  event: SerializedMatrixEvent;
  showSender: boolean;
  isOwn: boolean;
  onReply?: (eventId: string) => void;
}

// Discord-flat layout per design-system § 7.3:
//   - No bubble background; messages flow as plain rows
//   - 36px avatar gutter (left), only filled on the first message of a group
//   - Continuation rows indent under the gutter (avatar + 12px gap)
//   - Sender name uses role color; same-row baseline timestamp
//   - Whole row gets bg #35373C on hover
export const MessageBubble = memo(function MessageBubble({
  event,
  showSender,
  isOwn,
  onReply,
}: MessageBubbleProps) {
  const isMessage =
    event.type === "m.room.message" || event.type === "m.room.encrypted";
  if (!isMessage) return <SystemEventLine event={event} />;

  const time = formatTime(event.timestamp);
  const senderName = extractDisplayName(event.sender);
  const agentInfo = getAgentInfo(event.sender);

  return (
    <div
      className={`group relative flex gap-3 px-4 transition-colors duration-100 hover:bg-[#35373C]
                  ${showSender ? "mt-3" : "mt-0.5"}`}
    >
      {/* Avatar gutter — 36px wide */}
      <div className="w-9 shrink-0 pt-0.5">
        {showSender && (
          <RoomAvatar name={senderName} avatarMxc={null} isDirect size={36} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {showSender && (
          <div className="flex items-baseline gap-1">
            <span
              className="text-[13px] font-semibold"
              style={{ color: agentInfo.nameColor }}
            >
              {senderName}
            </span>
            <AgentTag agentInfo={agentInfo} size="sm" />
            <span className="ml-1 text-[10.5px] text-[#6D6F78]">{time}</span>
          </div>
        )}
        <div className="text-[13.5px] leading-[1.45] text-[#DBDEE1]">
          <MessageContent event={event} isOwn={isOwn} />
        </div>
      </div>

      {/* Hover toolbar — anchored top-right */}
      {onReply && (
        <div
          className="absolute -top-3 right-4 hidden items-center gap-0.5 rounded-md
                     border border-[#3F4147] bg-[#2B2D31] px-1 py-0.5 shadow-lg
                     group-hover:flex"
        >
          <button
            onClick={() => onReply(event.eventId)}
            className="rounded p-0.5 text-[#949BA4] transition-colors
                       hover:bg-[#383A40] hover:text-[#DBDEE1]"
            title="回复"
          >
            <ReplyIcon />
          </button>
        </div>
      )}
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
      <span className="rounded-full bg-[#2B2D31]/50 px-3 py-1 text-xs text-[#949BA4]">
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
