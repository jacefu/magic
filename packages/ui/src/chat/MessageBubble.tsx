import { memo } from "react";
import type { SerializedMatrixEvent } from "@magic/shared-types";
import {
  getClient,
  hasClient,
  useAuthStore,
  useUIStore,
} from "@magic/matrix-client";
import { RoomAvatar, pickGradient } from "../rooms/RoomAvatar.js";
import { MessageContent } from "./MessageContent.js";
import { AgentTag } from "../agents/AgentTag.js";
import { getAgentInfo } from "../lib/agentDetection.js";

interface MessageBubbleProps {
  event: SerializedMatrixEvent;
  showSender: boolean;
  isOwn: boolean;
  onReply?: (eventId: string) => void;
}

// Discord-flat layout:
//   - No bubble background; messages flow as plain rows
//   - 40px avatar gutter (left), only filled on the first message of a group
//   - 16px gap between avatar gutter and content
//   - Continuation rows indent under the gutter (avatar + 16px gap)
//   - Sender name 15px semibold in role color; baseline timestamp 12px muted
//   - Body 15px / line-height 1.55
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
  // The brand stripe and the avatar share the same gradient so each
  // sender gets a consistent personal color across the message row.
  // Agents get their role-specific gradient; humans fall through to
  // the hash-based palette (the same one RoomAvatar would pick).
  const senderGradient =
    avatarGradient(agentInfo) ?? pickGradient(senderName);

  // Resolve display name with the SDK if available — falls back to the
  // user's local part. Used for click-to-mention so it lines up with
  // resolveMentionsToPlaceholders' member lookup at send time.
  const mentionableName = useMentionableDisplayName(
    event.sender,
    senderName,
    event.roomId,
  );

  const isOwnSender = useAuthStore((s) => s.userId) === event.sender;
  const requestComposerInsert = useUIStore((s) => s.requestComposerInsert);

  const handleNameClick = () => {
    if (isOwnSender) return; // don't @ yourself
    requestComposerInsert(`@${mentionableName} `);
  };

  return (
    <div
      className={`group relative flex gap-3 px-4 transition-colors duration-100
                  hover:bg-[var(--msg-hover)]
                  ${showSender ? "mt-2.5" : "mt-0.5"}`}
    >
      {/* 2px stripe rendered on every message — color matches the
          sender's avatar gradient so each participant has a consistent
          personal hue running down the row. Opacity is themed via
          --ai-bar-opacity (0.5 dark, 0.6 light) so the stripe stays
          legible against either background. */}
      <span
        aria-hidden="true"
        className="absolute left-1.5 top-0 bottom-0 w-[2px] rounded-[1px]"
        style={{
          background: senderGradient,
          opacity: "var(--ai-bar-opacity)",
        }}
      />


      {/* Avatar gutter — 36px wide. Avatars share `senderGradient`
          with the left stripe so each sender's hue is consistent
          across the row. */}
      <div className="w-9 shrink-0 pt-0.5">
        {showSender && (
          <RoomAvatar
            name={senderName}
            avatarMxc={null}
            isDirect
            size={36}
            gradient={senderGradient}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {showSender && (
          <div className="mb-0.5 flex items-baseline gap-1.5">
            <button
              type="button"
              onClick={handleNameClick}
              disabled={isOwnSender}
              className="text-[12.5px] font-semibold leading-snug
                         transition-colors hover:underline
                         disabled:cursor-default disabled:no-underline"
              style={{ color: agentInfo.nameColor }}
              title={isOwnSender ? undefined : `@提及 ${mentionableName}`}
            >
              {senderName}
            </button>
            <AgentTag agentInfo={agentInfo} size="sm" />
            <span className="ml-1 text-[10px] text-[var(--text-tertiary)]">
              {time}
            </span>
          </div>
        )}
        <div className="text-[13px] leading-[1.5] text-[var(--text-primary)]">
          <MessageContent event={event} isOwn={isOwn} />
        </div>
      </div>

      {/* Hover toolbar — anchored top-right */}
      {onReply && (
        <div
          className="absolute -top-3 right-4 hidden items-center gap-0.5 rounded-md
                     border border-[var(--border-hover)] bg-[var(--bg-primary)]
                     px-1 py-0.5 shadow-lg backdrop-blur-md group-hover:flex"
        >
          <button
            onClick={() => onReply(event.eventId)}
            className="rounded p-0.5 text-[var(--text-secondary)] transition-colors
                       hover:bg-[var(--bg-surface)]
                       hover:text-[var(--text-primary)]"
            title="回复"
          >
            <ReplyIcon />
          </button>
        </div>
      )}
    </div>
  );
});

/** Cosmic AI § 7.5 — pick the role-specific avatar gradient from
 *  resolved AgentInfo. Returns undefined for humans so RoomAvatar
 *  falls back to its hash-based palette (where the default slot is
 *  already the human-blue gradient). */
function avatarGradient(agentInfo: {
  isAgent: boolean;
  runtime: "openclaw" | "hermes" | "qwenpaw" | null;
  role: "worker" | "manager" | null;
}): string | undefined {
  if (!agentInfo.isAgent) return undefined;
  if (agentInfo.role === "manager") {
    return "linear-gradient(135deg, #0D9488, #2DD4BF)";
  }
  switch (agentInfo.runtime) {
    case "hermes":
      return "linear-gradient(135deg, #DC2626, #F97316)";
    case "qwenpaw":
      return "linear-gradient(135deg, #D97706, #FBBF24)";
    case "openclaw":
    default:
      return "linear-gradient(135deg, #059669, #34D399)";
  }
}

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
      <span
        className="rounded-full px-3 py-1 text-[10px] text-[var(--text-secondary)]"
        style={{ background: "var(--bg-surface)" }}
      >
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

/** Match the SDK's joined-member display name (e.g. "manager 💕") so the
 *  click-to-mention text resolves cleanly via resolveMentionsToPlaceholders.
 *  Falls back to the user's local part when no member record is found. */
function useMentionableDisplayName(
  senderUserId: string,
  fallback: string,
  roomId: string,
): string {
  if (!hasClient()) return fallback;
  try {
    const room = getClient().getRoom(roomId);
    if (!room) return fallback;
    const member = room.getMember(senderUserId);
    return member?.name || fallback;
  } catch {
    return fallback;
  }
}

function formatTime(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());

  if (sameCalendarDay(date, now)) return `${hh}:${mm}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameCalendarDay(date, yesterday)) return `昨天 ${hh}:${mm}`;

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${hh}:${mm}`;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
