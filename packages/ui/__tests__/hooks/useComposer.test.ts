import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { sendTextMessageMock, sendReplyMock, sendTypingMock } = vi.hoisted(() => ({
  sendTextMessageMock: vi.fn().mockResolvedValue("$ev1"),
  sendReplyMock: vi.fn().mockResolvedValue("$ev2"),
  sendTypingMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@magic/matrix-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@magic/matrix-client")>();
  return {
    ...actual,
    sendTextMessage: sendTextMessageMock,
    sendReply: sendReplyMock,
    sendTyping: sendTypingMock,
  };
});

import { useRoomStore, useUIStore } from "@magic/matrix-client";
import { useComposer, __DRAFTS_INTERNAL__ } from "../../src/hooks/useComposer.js";

const ROOM_A = "!a:example.com";
const ROOM_B = "!b:example.com";

beforeEach(() => {
  sendTextMessageMock.mockClear();
  sendReplyMock.mockClear();
  sendTypingMock.mockClear();
  __DRAFTS_INTERNAL__.clear();
  useRoomStore.setState({ rooms: {}, activeRoomId: null });
  useUIStore.setState({ composerReplyTo: null });
});

describe("useComposer", () => {
  it("starts with empty value when no draft exists", () => {
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    expect(result.current.value).toBe("");
  });

  it("setValue updates the value", () => {
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    act(() => result.current.setValue("hello"));
    expect(result.current.value).toBe("hello");
  });

  it("setValue persists draft for the room", () => {
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    act(() => result.current.setValue("draft text"));
    expect(__DRAFTS_INTERNAL__.get(ROOM_A)).toBe("draft text");
  });

  it("switchRoom restores the other room's draft", () => {
    __DRAFTS_INTERNAL__.set(ROOM_B, "saved B draft");
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    act(() => result.current.setValue("on A"));
    act(() => result.current.switchRoom(ROOM_B));
    expect(result.current.value).toBe("saved B draft");
  });

  it("handleSend calls sendTextMessage when no replyTo", async () => {
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    act(() => result.current.setValue("hello"));
    await act(async () => {
      await result.current.handleSend();
    });
    expect(sendTextMessageMock).toHaveBeenCalledWith(ROOM_A, "hello");
    expect(sendReplyMock).not.toHaveBeenCalled();
  });

  it("handleSend calls sendReply when replyTo is set", async () => {
    useUIStore.setState({ composerReplyTo: "$reply:example.com" });
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    act(() => result.current.setValue("answer"));
    await act(async () => {
      await result.current.handleSend();
    });
    expect(sendReplyMock).toHaveBeenCalledWith(ROOM_A, "answer", "$reply:example.com");
  });

  it("handleSend clears the value and draft on success", async () => {
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    act(() => result.current.setValue("bye"));
    await act(async () => {
      await result.current.handleSend();
    });
    await waitFor(() => expect(result.current.value).toBe(""));
    expect(__DRAFTS_INTERNAL__.has(ROOM_A)).toBe(false);
  });

  it("handleSend clears replyTo after sending a reply", async () => {
    useUIStore.setState({ composerReplyTo: "$reply" });
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    act(() => result.current.setValue("ok"));
    await act(async () => {
      await result.current.handleSend();
    });
    expect(useUIStore.getState().composerReplyTo).toBeNull();
  });

  it("handleSend is a no-op for empty value", async () => {
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    await act(async () => {
      await result.current.handleSend();
    });
    expect(sendTextMessageMock).not.toHaveBeenCalled();
  });

  it("handleSend is a no-op for whitespace-only value", async () => {
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    act(() => result.current.setValue("   \n\t  "));
    await act(async () => {
      await result.current.handleSend();
    });
    expect(sendTextMessageMock).not.toHaveBeenCalled();
  });

  it("cancelReply clears replyTo", () => {
    useUIStore.setState({ composerReplyTo: "$reply" });
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    act(() => result.current.cancelReply());
    expect(useUIStore.getState().composerReplyTo).toBeNull();
  });

  it("startReply sets replyTo", () => {
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    act(() => result.current.startReply("$target:example.com"));
    expect(useUIStore.getState().composerReplyTo).toBe("$target:example.com");
  });

  it("replyEvent resolves to the matching timeline event", () => {
    useRoomStore.setState({
      rooms: {
        [ROOM_A]: {
          roomId: ROOM_A,
          name: "A",
          topic: "",
          avatarMxc: null,
          memberCount: 2,
          unreadCount: 0,
          highlightCount: 0,
          timeline: [
            {
              eventId: "$target",
              roomId: ROOM_A,
              type: "m.room.message",
              sender: "@alice:example.com",
              content: { msgtype: "m.text", body: "original" },
              timestamp: 1,
            },
          ],
          lastMessage: null,
          isEncrypted: false,
          isDirect: false,
          lastActivityTs: 0,
        },
      },
    });
    useUIStore.setState({ composerReplyTo: "$target" });
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    expect(result.current.replyEvent?.eventId).toBe("$target");
  });

  it("replyEvent is null when replyToEventId is null", () => {
    const { result } = renderHook(() => useComposer({ roomId: ROOM_A }));
    expect(result.current.replyEvent).toBeNull();
  });
});
