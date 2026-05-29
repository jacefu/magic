import { memo } from "react";
import {
  AGENTTEAMS_WORKSPACE,
  type SerializedMatrixEvent,
} from "@magic/shared-types";
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
import { stripWorkspaceContext } from "../hooks/useWorkspaceInjection.js";
import { WorkspaceFileCard } from "../workspace/WorkspaceFileCard.js";
import { WorkspaceContextBadge } from "../workspace/WorkspaceContextBadge.js";

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

  // Spec 022 v6 §6.4 — file projection: render the body as a folded
  // card so the user isn't drowned in raw file dumps. Agent still sees
  // the full body in the raw event.
  const projection = parseProjection(
    event.content as Record<string, unknown> | undefined,
  );
  if (projection) {
    if (projection.kind === "unbind") {
      return (
        <div
          className="flex justify-center px-4 py-2 text-[10.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {(event.content?.body as string | undefined) ?? ""}
        </div>
      );
    }
    if (projection.kind === "file_error") {
      return (
        <div
          className="mx-4 my-1 rounded-md px-3 py-1.5 text-[11px]"
          style={{
            background: "var(--bg-surface)",
            color: "var(--color-danger)",
          }}
        >
          {(event.content?.body as string | undefined) ?? `📄 ${projection.path}`}
        </div>
      );
    }
    // kind === "file"
    return (
      <div className="px-4">
        <WorkspaceFileCard
          path={projection.path}
          size={projection.size}
          rawBody={(event.content?.body as string | undefined) ?? ""}
        />
      </div>
    );
  }

  // Spec 022 v6 §6.4 — user message with auto-injected
  // `<workspace_context>` block: strip the block from the rendered
  // body, surface a small badge so the user knows it went out attached.
  const injected = parseInjected(
    event.content as Record<string, unknown> | undefined,
  );

  const time = formatTime(event.timestamp);
  const localpart = extractDisplayName(event.sender);
  const agentInfo = getAgentInfo(event.sender);

  // Resolve the live display name + avatar.
  //
  // For OWN messages we read from `useAuthStore` so a profile change
  // made via the settings panel reflects on the user's own bubbles
  // immediately (the homeserver's m.room.member echo back through
  // sync can take many seconds).
  //
  // For OTHER members we ask the SDK via room.getMember(); that's
  // the room-scoped name + avatar that the SDK keeps in sync as
  // events arrive. Falls back to the user-id localpart when no
  // SDK / member info is available.
  const ownUserId = useAuthStore((s) => s.userId);
  const ownDisplayName = useAuthStore((s) => s.displayName);
  const ownAvatarMxc = useAuthStore((s) => s.avatarMxc);
  const isOwnSender = ownUserId === event.sender;
  const sdkProfile = useSdkSenderProfile(
    event.sender,
    event.roomId,
    isOwnSender,
  );

  const senderName = isOwnSender
    ? (ownDisplayName ?? localpart)
    : (sdkProfile.displayName ?? localpart);
  const senderAvatarMxc = isOwnSender
    ? ownAvatarMxc
    : sdkProfile.avatarMxc;

  // The brand stripe and the letter-fallback avatar share the same
  // gradient so each sender gets a consistent personal color across
  // the message row. Agents get their role-specific gradient; humans
  // fall through to the hash-based palette.
  const senderGradient =
    avatarGradient(agentInfo) ?? pickGradient(senderName);

  // Used for click-to-mention so it lines up with
  // resolveMentionsToPlaceholders' member lookup at send time.
  const mentionableName = senderName;
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
            avatarMxc={senderAvatarMxc}
            isDirect
            size={36}
            isAgent={agentInfo.isAgent}
            userId={event.sender}
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
            {injected && (
              <WorkspaceContextBadge
                workspace={injected.workspace}
                contextLength={injected.contextLength}
              />
            )}
            <span className="ml-1 text-[10px] text-[var(--text-tertiary)]">
              {time}
            </span>
          </div>
        )}
        <div className="text-[13px] leading-[1.5] text-[var(--text-primary)]">
          {injected ? (
            <MessageContent
              event={event}
              isOwn={isOwn}
              searchQuery={searchQuery}
              bodyOverride={stripWorkspaceContext(
                (event.content?.body as string | undefined) ?? "",
              )}
            />
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
      if (membership === "leave") {
        // Suppress stale leaves: if the sender is currently joined to
        // this room, this event is from a prior session (they left and
        // later rejoined). Showing "X 离开了房间" right above their
        // brand-new message is the bug we keep hitting. For the
        // typical leave/rejoin case event.sender == state_key, so this
        // is sufficient without enriching the serializer.
        if (isCurrentlyJoined(event.roomId, event.sender)) return null;
        return `${sender} 离开了房间`;
      }
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

function isCurrentlyJoined(roomId: string, userId: string): boolean {
  if (!hasClient()) return false;
  try {
    const room = getClient().getRoom(roomId);
    if (!room) return false;
    const member = room.getMember(userId);
    return member?.membership === "join";
  } catch {
    return false;
  }
}

function extractDisplayName(userId: string): string {
  const match = userId.match(/^@([^:]+)/);
  return match ? match[1] : userId;
}

/**
 * Pull the room-scoped member profile (display name + avatar) out of
 * the SDK so MessageBubble can render the latest values for everyone
 * except the local user. We skip the lookup for own messages — the
 * caller reads from useAuthStore directly there to avoid a sync
 * round-trip.
 *
 * Hooks rule: this is a plain function (no hook prefix in old code
 * was misleading) — it doesn't subscribe to anything, so it just
 * reads once per render. That's fine: room.getMember already returns
 * the latest snapshot the SDK has, and a re-render is triggered by
 * the upstream timeline event flow whenever a member event lands.
 */
function useSdkSenderProfile(
  senderUserId: string,
  roomId: string,
  isOwnSender: boolean,
): { displayName: string | null; avatarMxc: string | null } {
  if (isOwnSender || !hasClient()) {
    return { displayName: null, avatarMxc: null };
  }
  try {
    const room = getClient().getRoom(roomId);
    if (!room) return { displayName: null, avatarMxc: null };
    const member = room.getMember(senderUserId);
    if (!member) return { displayName: null, avatarMxc: null };
    return {
      displayName: member.name || null,
      avatarMxc: member.getMxcAvatarUrl() || null,
    };
  } catch {
    return { displayName: null, avatarMxc: null };
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

// ---- Spec 022 v6 §6.4 helpers ----

interface InjectedMeta {
  workspace: string;
  contextLength?: number;
}

/** Pluck the v6 injected-context marker. Each field is guarded so a
 *  malformed payload collapses to `null` (the bubble falls back to
 *  default rendering) instead of crashing. */
function parseInjected(
  content: Record<string, unknown> | undefined,
): InjectedMeta | null {
  if (!content) return null;
  const raw = content[AGENTTEAMS_WORKSPACE.INJECTED];
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const workspace =
    typeof obj.workspace === "string" ? obj.workspace : "";
  if (!workspace) return null;
  return {
    workspace,
    contextLength:
      typeof obj.contextLength === "number" ? obj.contextLength : undefined,
  };
}

type ProjectionMeta =
  | { kind: "file"; path: string; size: number; mtime: number }
  | { kind: "file_error"; path: string }
  | { kind: "unbind" };

/** Pluck the v6 file-projection marker. The shape depends on `kind`
 *  so we discriminate up front. */
function parseProjection(
  content: Record<string, unknown> | undefined,
): ProjectionMeta | null {
  if (!content) return null;
  const raw = content[AGENTTEAMS_WORKSPACE.PROJECTION];
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const kind = obj.kind;
  if (kind === "file") {
    const path = typeof obj.path === "string" ? obj.path : "";
    if (!path) return null;
    return {
      kind: "file",
      path,
      size: typeof obj.size === "number" ? obj.size : 0,
      mtime: typeof obj.mtime === "number" ? obj.mtime : 0,
    };
  }
  if (kind === "file_error") {
    const path = typeof obj.path === "string" ? obj.path : "";
    return { kind: "file_error", path };
  }
  if (kind === "unbind") return { kind: "unbind" };
  return null;
}
