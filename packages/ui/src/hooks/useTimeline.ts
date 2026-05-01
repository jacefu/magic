import { useMemo } from "react";
import { useRoomStore, useTypingStore } from "@magic/matrix-client";
import type { SerializedMatrixEvent } from "@magic/shared-types";

export type TimelineItem =
  | { type: "message"; event: SerializedMatrixEvent; showSender: boolean; isOwn: boolean }
  | { type: "date-separator"; date: string; key: string }
  | { type: "unread-divider"; date: string | null; key: string }
  | { type: "typing"; users: string[] };

interface UseTimelineOptions {
  roomId: string;
  currentUserId: string | null;
  /**
   * Snapshot of `room.getEventReadUpTo(myUserId)` taken when the room was
   * opened. The first event after this id gets an unread divider above it.
   * If the eventId isn't in the loaded timeline (paginated out), or if it
   * matches the last event, no divider is emitted.
   */
  unreadMarkerEventId?: string | null;
}

const EMPTY: never[] = [];

export function useTimeline({
  roomId,
  currentUserId,
  unreadMarkerEventId = null,
}: UseTimelineOptions) {
  const timeline = useRoomStore((s) => s.rooms[roomId]?.timeline ?? EMPTY);
  const typingUsers = useTypingStore((s) => s.typing[roomId] ?? EMPTY);

  const items: TimelineItem[] = useMemo(() => {
    const result: TimelineItem[] = [];
    let lastDate = "";
    let lastSender = "";
    let lastTs = 0;

    // Pre-compute the index of the first unread event so we know where to
    // splice the divider. Skip the divider when the marker isn't visible
    // (paginated out) or when it points at the most recent event.
    const firstUnreadIndex = computeFirstUnreadIndex(
      timeline,
      unreadMarkerEventId,
      currentUserId,
    );

    for (let i = 0; i < timeline.length; i++) {
      const event = timeline[i];
      const isMessage =
        event.type === "m.room.message" || event.type === "m.room.encrypted";
      const isStateEvent = isStateType(event.type);
      if (!isMessage && !isStateEvent) continue;

      const dateStr = formatDateSeparator(event.timestamp);
      const dateChanged = dateStr !== lastDate;
      const isFirstUnread = i === firstUnreadIndex;

      if (isFirstUnread) {
        // Merge with date-separator when the unread starts on a new day.
        result.push({
          type: "unread-divider",
          date: dateChanged ? dateStr : null,
          key: `unread-${event.eventId}`,
        });
        if (dateChanged) {
          lastDate = dateStr;
          lastSender = "";
        }
      } else if (dateChanged) {
        result.push({
          type: "date-separator",
          date: dateStr,
          key: `date-${event.timestamp}`,
        });
        lastDate = dateStr;
        lastSender = "";
      }

      const sameGroup =
        event.sender === lastSender &&
        event.timestamp - lastTs < 5 * 60 * 1000;

      result.push({
        type: "message",
        event,
        showSender: !sameGroup,
        isOwn: event.sender === currentUserId,
      });

      lastSender = event.sender;
      lastTs = event.timestamp;
    }

    if (typingUsers.length > 0) {
      const filtered = typingUsers.filter((u) => u !== currentUserId);
      if (filtered.length > 0) {
        result.push({ type: "typing", users: filtered });
      }
    }

    return result;
  }, [timeline, typingUsers, currentUserId, unreadMarkerEventId]);

  return { items, messageCount: timeline.length };
}

/**
 * Returns the index of the first event whose eventId is *strictly after*
 * the given marker. Returns -1 when:
 *   - marker is null/empty,
 *   - marker isn't found in the loaded timeline,
 *   - marker is the last event (everything is read),
 *   - the only candidate event is from the current user (own-write).
 */
function computeFirstUnreadIndex(
  timeline: ReadonlyArray<SerializedMatrixEvent>,
  markerEventId: string | null | undefined,
  currentUserId: string | null,
): number {
  if (!markerEventId) return -1;
  const markerIdx = timeline.findIndex((e) => e.eventId === markerEventId);
  if (markerIdx < 0) return -1;
  // Skip own messages and non-message types so the divider lands on real
  // unread content.
  for (let i = markerIdx + 1; i < timeline.length; i++) {
    const e = timeline[i];
    const isMessage =
      e.type === "m.room.message" || e.type === "m.room.encrypted";
    if (!isMessage) continue;
    if (e.sender === currentUserId) continue;
    return i;
  }
  return -1;
}

function isStateType(type: string): boolean {
  return [
    "m.room.member",
    "m.room.topic",
    "m.room.name",
    "m.room.encryption",
  ].includes(type);
}

function formatDateSeparator(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return "今天";
  if (isSameDay(date, yesterday)) return "昨天";

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (year === today.getFullYear()) {
    return `${month}月${day}日`;
  }
  return `${year}年${month}月${day}日`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
