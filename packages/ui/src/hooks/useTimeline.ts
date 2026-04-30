import { useMemo } from "react";
import { useRoomStore, useTypingStore } from "@magic/matrix-client";
import type { SerializedMatrixEvent } from "@magic/shared-types";

export type TimelineItem =
  | { type: "message"; event: SerializedMatrixEvent; showSender: boolean; isOwn: boolean }
  | { type: "date-separator"; date: string; key: string }
  | { type: "typing"; users: string[] };

interface UseTimelineOptions {
  roomId: string;
  currentUserId: string | null;
}

const EMPTY: never[] = [];

export function useTimeline({ roomId, currentUserId }: UseTimelineOptions) {
  const timeline = useRoomStore((s) => s.rooms[roomId]?.timeline ?? EMPTY);
  const typingUsers = useTypingStore((s) => s.typing[roomId] ?? EMPTY);

  const items: TimelineItem[] = useMemo(() => {
    const result: TimelineItem[] = [];
    let lastDate = "";
    let lastSender = "";
    let lastTs = 0;

    for (const event of timeline) {
      const isMessage = event.type === "m.room.message";
      const isStateEvent = isStateType(event.type);
      if (!isMessage && !isStateEvent) continue;

      const dateStr = formatDateSeparator(event.timestamp);
      if (dateStr !== lastDate) {
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
  }, [timeline, typingUsers, currentUserId]);

  return { items, messageCount: timeline.length };
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
