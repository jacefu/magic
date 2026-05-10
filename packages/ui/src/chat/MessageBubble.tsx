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
  /**
   * Active in-room search query. When >= 2 chars, MessageContent
   * highlights matching substrings in the rendered text.
   */
  searchQuery?: string;
  /**
   * True when this bubble is the currently-selected search hit. Paints
   * a brand-tinted ring + soft tint so the user can see exactly which
   * message the counter refers to.
   */
  isHighlighted?: boolean;
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
  searchQuery,
  isHighlighted,
}: MessageBubbleProps) {
  const isMessage =
    event.type === "m.room.message" || event.type === "m.room.encrypted";
  if (!isMessage) return <SystemEventLine event={event} />;

  // Spec 022 v3 §5.2.6 — extract the workspace-attachment metadata
  // up front so the chip strip below has structured access to it
  // without re-parsing the raw event.content payload.
  const workspaceAttached = parseWorkspaceAttached(
    event.content as Record<string, unknown> | undefined,
  );

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
      id={`msg-${event.eventId}`}
      className={`group relative flex gap-3 px-4 transition-colors duration-200
                  ${
                    isHighlighted
                      ? "ring-1 ring-[var(--brand-purple)]"
                      : "hover:bg-[var(--msg-hover)]"
                  }
                  ${showSender ? "mt-2.5" : "mt-0.5"}`}
      style={
        isHighlighted ? { background: "rgba(108,92,231,0.08)" } : undefined
      }
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
          {/* Spec 022 v3 §5.2.6 — when the message carries workspace
              attachments, render the user-typed text *only* (truncated
              at the separator the interceptor inserts) and surface the
              attached files as chips below. The full body — code
              blocks included — stays in the raw event so the Agent's
              LLM sees everything. */}
          {workspaceAttached ? (
            <>
              <MessageContent
                event={event}
                isOwn={isOwn}
                searchQuery={searchQuery}
                bodyOverride={truncateBeforeSeparator(
                  (event.content?.body as string | undefined) ?? "",
                )}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {workspaceAttached.files.map((f) => (
                  <span
                    key={f.path}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px]"
                    style={{
                      background: "var(--bg-surface)",
                      border: "0.5px solid var(--border-default)",
                      color: "var(--text-secondary)",
                    }}
                    title={
                      f.inlined
                        ? `${f.path} · 已内联到消息正文 · ${formatChipSize(f.size)}`
                        : `${f.path} · 已作为附件上传 · ${formatChipSize(f.size)}`
                    }
                  >
                    <span aria-hidden>📄</span>
                    <span className="font-mono">{f.path}</span>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      · {formatChipSize(f.size)}
                    </span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <MessageContent
              event={event}
              isOwn={isOwn}
              searchQuery={searchQuery}
            />
          )}
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

// ---- Spec 022 v3 §5.2.6 helpers ----

interface WorkspaceAttachedFile {
  path: string;
  size: number;
  inlined: boolean;
}

interface WorkspaceAttachedMeta {
  workspaceName: string;
  files: WorkspaceAttachedFile[];
}

/** Pluck the typed shape out of the loose `event.content`. We don't
 *  trust upstream, so each field is guarded — a malformed payload
 *  collapses to `null` and the bubble falls back to the default
 *  rendering instead of crashing. */
function parseWorkspaceAttached(
  content: Record<string, unknown> | undefined,
): WorkspaceAttachedMeta | null {
  if (!content) return null;
  const raw = content["com.magic.workspace.attached"];
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const files = obj.files;
  if (!Array.isArray(files)) return null;
  const parsed: WorkspaceAttachedFile[] = [];
  for (const f of files) {
    if (!f || typeof f !== "object") continue;
    const entry = f as Record<string, unknown>;
    if (typeof entry.path !== "string") continue;
    parsed.push({
      path: entry.path,
      size: typeof entry.size === "number" ? entry.size : 0,
      inlined: !!entry.inlined,
    });
  }
  if (parsed.length === 0) return null;
  return {
    workspaceName:
      typeof obj.workspaceName === "string" ? obj.workspaceName : "",
    files: parsed,
  };
}

/** The interceptor delimits user-typed text from the inlined code
 *  blocks with `\n\n────────`. Slice at the first occurrence so the
 *  human view doesn't see the raw code dump. Falls back to the full
 *  body when the separator is absent (paranoid). */
function truncateBeforeSeparator(body: string): string {
  const sep = "\n\n────────";
  const idx = body.indexOf(sep);
  return idx === -1 ? body : body.slice(0, idx);
}

function formatChipSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
