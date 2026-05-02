import {
  useAuthStore,
  useNotificationStore,
  useRoomStore,
  type RoomData,
  type NotificationLevel,
} from "@magic/matrix-client";
import type { SerializedMatrixEvent } from "@magic/shared-types";
import { isElectron } from "../hooks/useElectronAPI.js";
import { playMessageSound, playMentionSound } from "./NotificationSound.js";

/**
 * Pure decision: should this event trigger a notification?
 * Split from `evaluateNotification` so the rule logic can be tested
 * in isolation without mocking audio / Electron / Notification APIs.
 *
 * Returns `null` to suppress, `"normal"` for a regular ping, `"mention"` for
 * a mention-style ping (different sound, different title).
 */
export interface NotificationDecisionContext {
  currentUserId: string | null;
  activeRoomId: string | null;
  windowFocused: boolean;
  level: NotificationLevel;
  dnd: boolean;
  isRoomMuted: (roomId: string) => boolean;
}

export type NotificationDecision = null | "normal" | "mention";

export function evaluateShouldNotify(
  event: SerializedMatrixEvent,
  ctx: NotificationDecisionContext,
): NotificationDecision {
  // Only message events count. State events, reactions, etc. are silent.
  if (event.type !== "m.room.message") return null;

  // Don't notify on our own echoes.
  if (event.sender === ctx.currentUserId) return null;

  if (ctx.dnd) return null;
  if (ctx.level === "mute") return null;
  if (ctx.isRoomMuted(event.roomId)) return null;

  // Looking right at the room with the window focused — visual presence
  // counts as "delivered", no need to ping.
  if (ctx.activeRoomId === event.roomId && ctx.windowFocused) return null;

  const mentioned = isMentionedInEvent(event, ctx.currentUserId);

  // "Mentions only" mode swallows everything that isn't an @mention.
  if (ctx.level === "mentions" && !mentioned) return null;

  return mentioned ? "mention" : "normal";
}

/**
 * Detect whether an event @mentions the given user. Reads the structured
 * `m.mentions` field first (Matrix v1.7+), falls back to a substring scan
 * of `body` for the user's localpart.
 */
export function isMentionedInEvent(
  event: SerializedMatrixEvent,
  userId: string | null,
): boolean {
  if (!userId) return false;

  const mentions = event.content["m.mentions"] as
    | { user_ids?: string[]; room?: boolean }
    | undefined;

  if (mentions) {
    if (mentions.user_ids?.includes(userId)) return true;
    if (mentions.room === true) return true;
  }

  const body = (event.content.body as string | undefined) ?? "";
  const localpart = userId.match(/^@([^:]+)/)?.[1];
  if (localpart && body.includes(`@${localpart}`)) return true;

  return false;
}

/**
 * Top-level entry point — read live store state, decide, and deliver.
 * Called by the matrix-client bridge for every appended timeline event.
 */
export function evaluateNotification(event: SerializedMatrixEvent): void {
  const authStore = useAuthStore.getState();
  const roomStore = useRoomStore.getState();
  const notifStore = useNotificationStore.getState();

  const decision = evaluateShouldNotify(event, {
    currentUserId: authStore.userId,
    activeRoomId: roomStore.activeRoomId,
    windowFocused: isWindowFocused(),
    level: notifStore.level,
    dnd: notifStore.dnd,
    isRoomMuted: notifStore.isRoomMuted,
  });

  // Tray badge needs to update on every message (even ones we don't ping
  // for) so the user can see "you have unread" without being audibly
  // pinged.
  recomputeAndPushTrayBadge();

  if (decision === null) return;

  const senderName = extractDisplayName(event.sender);
  const room = roomStore.rooms[event.roomId];
  const roomName = room?.name ?? "未知房间";
  const messagePreview = getMessagePreview(event);

  showDesktopNotification({
    title:
      decision === "mention"
        ? `${senderName} 在 ${roomName} 中提及了你`
        : senderName,
    body: messagePreview,
    roomId: event.roomId,
    eventId: event.eventId,
  });

  if (notifStore.soundEnabled) {
    if (decision === "mention") playMentionSound();
    else playMessageSound();
  }
}

function showDesktopNotification(payload: {
  title: string;
  body: string;
  roomId: string;
  eventId: string;
}): void {
  if (isElectron()) {
    try {
      void window.electronAPI.showNotification({
        title: payload.title,
        body: payload.body,
        roomId: payload.roomId,
        eventId: payload.eventId,
      });
    } catch {
      /* silent */
    }
    return;
  }

  if (
    typeof window === "undefined" ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  ) {
    return;
  }
  try {
    const notif = new Notification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      tag: payload.roomId, // collapse repeated pings from one room
      silent: true, // sound is driven by us, not the OS
    });
    notif.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      useRoomStore.getState().setActiveRoom(payload.roomId);
    };
  } catch {
    /* silent */
  }
}

/**
 * Walk the room store, sum unread + highlight counts excluding muted
 * rooms, push the totals into the notification store and out to the
 * native tray badge (Electron only).
 */
export function recomputeAndPushTrayBadge(): void {
  const rooms = useRoomStore.getState().rooms;
  const notifStore = useNotificationStore.getState();

  let totalUnread = 0;
  let totalMentions = 0;
  for (const room of Object.values(rooms) as RoomData[]) {
    if (notifStore.isRoomMuted(room.roomId)) continue;
    totalUnread += room.unreadCount;
    totalMentions += room.highlightCount;
  }
  notifStore.setUnreadCounts(totalUnread, totalMentions);

  if (isElectron()) {
    try {
      const api = window.electronAPI as unknown as {
        setBadgeCount?: (n: number) => Promise<void>;
      };
      void api.setBadgeCount?.(totalUnread);
    } catch {
      /* silent */
    }
  }
}

function isWindowFocused(): boolean {
  return typeof document !== "undefined" && document.hasFocus();
}

function extractDisplayName(userId: string): string {
  return userId.match(/^@([^:]+)/)?.[1] ?? userId;
}

function getMessagePreview(event: SerializedMatrixEvent): string {
  const content = event.content;
  const msgtype = content.msgtype as string | undefined;
  const body = (content.body as string | undefined) ?? "";

  switch (msgtype) {
    case "m.text":
    case "m.notice":
    case "m.emote":
      return body.slice(0, 100);
    case "m.image":
      return "📷 发送了一张图片";
    case "m.file":
      return "📎 发送了一个文件";
    case "m.video":
      return "🎬 发送了一个视频";
    case "m.audio":
      return "🎵 发送了一段音频";
    default:
      return body.slice(0, 100);
  }
}
