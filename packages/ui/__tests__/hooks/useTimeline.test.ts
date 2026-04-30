import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRoomStore, useTypingStore } from "@magic/matrix-client";
import type { SerializedMatrixEvent } from "@magic/shared-types";
import { useTimeline } from "../../src/hooks/useTimeline.js";

const ROOM_ID = "!room:example.com";
const USER_ID = "@me:example.com";
const OTHER_ID = "@alice:example.com";

function makeEvent(
  overrides: Partial<SerializedMatrixEvent> & { timestamp: number },
): SerializedMatrixEvent {
  return {
    eventId: `$ev${overrides.timestamp}`,
    roomId: ROOM_ID,
    type: "m.room.message",
    sender: OTHER_ID,
    content: { msgtype: "m.text", body: "Hello" },
    ...overrides,
  };
}

beforeEach(() => {
  useRoomStore.setState({ rooms: {}, activeRoomId: null });
  useTypingStore.setState({ typing: {} });
});

function setTimeline(events: SerializedMatrixEvent[]) {
  useRoomStore.setState({
    rooms: {
      [ROOM_ID]: {
        roomId: ROOM_ID,
        name: "Test",
        topic: "",
        avatarMxc: null,
        memberCount: 2,
        unreadCount: 0,
        highlightCount: 0,
        timeline: events,
        lastMessage: null,
        isEncrypted: false,
        isDirect: false,
        lastActivityTs: 0,
      },
    },
  });
}

describe("useTimeline", () => {
  it("returns empty items for an empty timeline", () => {
    setTimeline([]);
    const { result } = renderHook(() =>
      useTimeline({ roomId: ROOM_ID, currentUserId: USER_ID }),
    );
    expect(result.current.items).toHaveLength(0);
    expect(result.current.messageCount).toBe(0);
  });

  it("inserts a date separator before the first message", () => {
    setTimeline([makeEvent({ timestamp: Date.now() })]);
    const { result } = renderHook(() =>
      useTimeline({ roomId: ROOM_ID, currentUserId: USER_ID }),
    );
    const items = result.current.items;
    expect(items[0].type).toBe("date-separator");
    expect(items[1].type).toBe("message");
  });

  it("inserts a date separator when date changes between messages", () => {
    const day1 = new Date("2024-01-01T10:00:00").getTime();
    const day2 = new Date("2024-01-02T10:00:00").getTime();
    setTimeline([makeEvent({ timestamp: day1 }), makeEvent({ timestamp: day2 })]);
    const { result } = renderHook(() =>
      useTimeline({ roomId: ROOM_ID, currentUserId: USER_ID }),
    );
    const separators = result.current.items.filter((i) => i.type === "date-separator");
    expect(separators).toHaveLength(2);
  });

  it("does not insert extra separator for messages on the same day", () => {
    const base = new Date("2024-01-01T10:00:00").getTime();
    setTimeline([
      makeEvent({ timestamp: base }),
      makeEvent({ timestamp: base + 60_000 }),
    ]);
    const { result } = renderHook(() =>
      useTimeline({ roomId: ROOM_ID, currentUserId: USER_ID }),
    );
    const separators = result.current.items.filter((i) => i.type === "date-separator");
    expect(separators).toHaveLength(1);
  });

  it("marks own messages with isOwn=true", () => {
    setTimeline([makeEvent({ sender: USER_ID, timestamp: Date.now() })]);
    const { result } = renderHook(() =>
      useTimeline({ roomId: ROOM_ID, currentUserId: USER_ID }),
    );
    const msg = result.current.items.find((i) => i.type === "message");
    expect(msg?.type === "message" && msg.isOwn).toBe(true);
  });

  it("marks other's messages with isOwn=false", () => {
    setTimeline([makeEvent({ sender: OTHER_ID, timestamp: Date.now() })]);
    const { result } = renderHook(() =>
      useTimeline({ roomId: ROOM_ID, currentUserId: USER_ID }),
    );
    const msg = result.current.items.find((i) => i.type === "message");
    expect(msg?.type === "message" && msg.isOwn).toBe(false);
  });

  it("collapses sender for messages within 5 min of same sender", () => {
    const base = Date.now();
    setTimeline([
      makeEvent({ sender: OTHER_ID, timestamp: base }),
      makeEvent({ sender: OTHER_ID, timestamp: base + 2 * 60_000 }), // 2 min later
    ]);
    const { result } = renderHook(() =>
      useTimeline({ roomId: ROOM_ID, currentUserId: USER_ID }),
    );
    const messages = result.current.items.filter((i) => i.type === "message");
    expect(messages[0].type === "message" && messages[0].showSender).toBe(true);
    expect(messages[1].type === "message" && messages[1].showSender).toBe(false);
  });

  it("shows sender again after 5+ minutes from same sender", () => {
    const base = Date.now();
    setTimeline([
      makeEvent({ sender: OTHER_ID, timestamp: base }),
      makeEvent({ sender: OTHER_ID, timestamp: base + 6 * 60_000 }), // 6 min later
    ]);
    const { result } = renderHook(() =>
      useTimeline({ roomId: ROOM_ID, currentUserId: USER_ID }),
    );
    const messages = result.current.items.filter((i) => i.type === "message");
    expect(messages[0].type === "message" && messages[0].showSender).toBe(true);
    expect(messages[1].type === "message" && messages[1].showSender).toBe(true);
  });

  it("shows sender again after sender changes", () => {
    const base = Date.now();
    setTimeline([
      makeEvent({ sender: OTHER_ID, timestamp: base }),
      makeEvent({ sender: USER_ID, timestamp: base + 60_000 }),
    ]);
    const { result } = renderHook(() =>
      useTimeline({ roomId: ROOM_ID, currentUserId: USER_ID }),
    );
    const messages = result.current.items.filter((i) => i.type === "message");
    expect(messages[1].type === "message" && messages[1].showSender).toBe(true);
  });

  it("appends typing indicator when others are typing", () => {
    setTimeline([makeEvent({ timestamp: Date.now() })]);
    useTypingStore.setState({ typing: { [ROOM_ID]: [OTHER_ID] } });
    const { result } = renderHook(() =>
      useTimeline({ roomId: ROOM_ID, currentUserId: USER_ID }),
    );
    const lastItem = result.current.items.at(-1);
    expect(lastItem?.type).toBe("typing");
    expect(lastItem?.type === "typing" && lastItem.users).toContain(OTHER_ID);
  });

  it("filters current user from typing list", () => {
    setTimeline([]);
    useTypingStore.setState({ typing: { [ROOM_ID]: [USER_ID] } });
    const { result } = renderHook(() =>
      useTimeline({ roomId: ROOM_ID, currentUserId: USER_ID }),
    );
    const typingItem = result.current.items.find((i) => i.type === "typing");
    expect(typingItem).toBeUndefined();
  });

  it("skips non-message, non-state events", () => {
    setTimeline([
      makeEvent({ type: "m.reaction", timestamp: Date.now() }),
    ]);
    const { result } = renderHook(() =>
      useTimeline({ roomId: ROOM_ID, currentUserId: USER_ID }),
    );
    expect(result.current.items).toHaveLength(0);
  });
});
