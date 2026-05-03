import { describe, it, expect, beforeEach } from "vitest";
import { useRoomStore } from "../src/stores/roomStore.js";
import { useSyncStore } from "../src/stores/syncStore.js";
import { useTypingStore } from "../src/stores/typingStore.js";
import type { SerializedMatrixEvent } from "@magic/shared-types";

const SID = "session_a";

function makeEvent(id: string, ts = 1000): SerializedMatrixEvent {
  return {
    eventId: id,
    roomId: "!room:example.com",
    type: "m.room.message",
    sender: "@alice:example.com",
    content: { msgtype: "m.text", body: "hello" },
    timestamp: ts,
  };
}

describe("roomStore", () => {
  beforeEach(() => {
    useRoomStore.getState().reset();
    useRoomStore.getState().setActiveSession(SID);
  });

  it("upsertRoom creates room if missing", () => {
    useRoomStore.getState().upsertRoom(SID, "!room:example.com", { name: "Test" });
    const room = useRoomStore.getState().rooms["!room:example.com"];
    expect(room.name).toBe("Test");
  });

  it("addMessage deduplicates events", () => {
    const evt = makeEvent("$evt1");
    useRoomStore.getState().addMessage(SID, "!room:example.com", evt);
    useRoomStore.getState().addMessage(SID, "!room:example.com", evt);
    expect(useRoomStore.getState().rooms["!room:example.com"].timeline).toHaveLength(1);
  });

  it("addMessage updates lastMessage", () => {
    useRoomStore.getState().addMessage(SID, "!room:example.com", makeEvent("$evt1", 1000));
    useRoomStore.getState().addMessage(SID, "!room:example.com", makeEvent("$evt2", 2000));
    expect(useRoomStore.getState().rooms["!room:example.com"].lastMessage?.eventId).toBe("$evt2");
  });

  it("addMessage inserts late-arriving events in timestamp order", () => {
    // /sync can deliver an older event after a newer one (federation
    // delay). The timeline must stay chronologically sorted regardless
    // of arrival order.
    useRoomStore.getState().addMessage(SID, "!room:example.com", makeEvent("$late", 2053));
    useRoomStore.getState().addMessage(SID, "!room:example.com", makeEvent("$early", 2047));
    const timeline = useRoomStore.getState().rooms["!room:example.com"].timeline;
    expect(timeline.map((e) => e.eventId)).toEqual(["$early", "$late"]);
  });

  it("addMessage keeps lastMessage pinned to the newest event, even if an older one arrives later", () => {
    useRoomStore.getState().addMessage(SID, "!room:example.com", makeEvent("$newer", 2053));
    useRoomStore.getState().addMessage(SID, "!room:example.com", makeEvent("$older", 2047));
    expect(
      useRoomStore.getState().rooms["!room:example.com"].lastMessage?.eventId,
    ).toBe("$newer");
  });

  it("prependMessages prepends without duplicates", () => {
    useRoomStore.getState().addMessage(SID, "!room:example.com", makeEvent("$evt2"));
    useRoomStore.getState().prependMessages(SID, "!room:example.com", [makeEvent("$evt1"), makeEvent("$evt2")]);
    const timeline = useRoomStore.getState().rooms["!room:example.com"].timeline;
    expect(timeline).toHaveLength(2);
    expect(timeline[0].eventId).toBe("$evt1");
  });

  it("setUnreadCount updates counts", () => {
    useRoomStore.getState().upsertRoom(SID, "!room:example.com", {});
    useRoomStore.getState().setUnreadCount(SID, "!room:example.com", 5, 2);
    const room = useRoomStore.getState().rooms["!room:example.com"];
    expect(room.unreadCount).toBe(5);
    expect(room.highlightCount).toBe(2);
  });

  it("removeRoom removes room and clears activeRoomId", () => {
    useRoomStore.getState().upsertRoom(SID, "!room:example.com", {});
    useRoomStore.getState().setActiveRoom("!room:example.com");
    useRoomStore.getState().removeRoom(SID, "!room:example.com");
    expect(useRoomStore.getState().rooms["!room:example.com"]).toBeUndefined();
    expect(useRoomStore.getState().activeRoomId).toBeNull();
  });

  describe("session partitioning", () => {
    it("writes from one session don't bleed into another", () => {
      useRoomStore.getState().upsertRoom("session_a", "!a:x", { name: "A-room" });
      useRoomStore.getState().upsertRoom("session_b", "!b:x", { name: "B-room" });

      // Active is session_a (set in beforeEach via setActiveSession(SID))
      useRoomStore.getState().setActiveSession("session_a");
      expect(useRoomStore.getState().rooms["!a:x"]?.name).toBe("A-room");
      expect(useRoomStore.getState().rooms["!b:x"]).toBeUndefined();

      useRoomStore.getState().setActiveSession("session_b");
      expect(useRoomStore.getState().rooms["!b:x"]?.name).toBe("B-room");
      expect(useRoomStore.getState().rooms["!a:x"]).toBeUndefined();
    });

    it("removeSession drops only that session's partition", () => {
      useRoomStore.getState().upsertRoom("session_a", "!a:x", { name: "A" });
      useRoomStore.getState().upsertRoom("session_b", "!b:x", { name: "B" });
      useRoomStore.getState().removeSession("session_a");
      expect(useRoomStore.getState().sessionRooms["session_a"]).toBeUndefined();
      expect(useRoomStore.getState().sessionRooms["session_b"]).toBeDefined();
    });
  });

  describe("navigation history", () => {
    const A = "!a:x";
    const B = "!b:x";
    const C = "!c:x";

    it("setActiveRoom pushes the previous room onto backStack", () => {
      useRoomStore.getState().setActiveRoom(A);
      useRoomStore.getState().setActiveRoom(B);
      const state = useRoomStore.getState();
      expect(state.activeRoomId).toBe(B);
      expect(state.backStack).toEqual([A]);
      expect(state.forwardStack).toEqual([]);
    });

    it("setActiveRoom is a no-op when the room is already active", () => {
      useRoomStore.getState().setActiveRoom(A);
      useRoomStore.getState().setActiveRoom(A);
      const state = useRoomStore.getState();
      expect(state.backStack).toEqual([]);
    });

    it("goBack pops backStack and pushes the current onto forwardStack", () => {
      useRoomStore.getState().setActiveRoom(A);
      useRoomStore.getState().setActiveRoom(B);
      useRoomStore.getState().goBack();
      const state = useRoomStore.getState();
      expect(state.activeRoomId).toBe(A);
      expect(state.backStack).toEqual([]);
      expect(state.forwardStack).toEqual([B]);
    });

    it("goForward replays a previously-popped room", () => {
      useRoomStore.getState().setActiveRoom(A);
      useRoomStore.getState().setActiveRoom(B);
      useRoomStore.getState().goBack();
      useRoomStore.getState().goForward();
      const state = useRoomStore.getState();
      expect(state.activeRoomId).toBe(B);
      expect(state.backStack).toEqual([A]);
      expect(state.forwardStack).toEqual([]);
    });

    it("a fresh setActiveRoom invalidates the forward stack", () => {
      useRoomStore.getState().setActiveRoom(A);
      useRoomStore.getState().setActiveRoom(B);
      useRoomStore.getState().goBack(); // back to A, B in forward
      useRoomStore.getState().setActiveRoom(C);
      const state = useRoomStore.getState();
      expect(state.activeRoomId).toBe(C);
      expect(state.forwardStack).toEqual([]);
    });

    it("goBack is a no-op when the back stack is empty", () => {
      useRoomStore.getState().setActiveRoom(A);
      useRoomStore.getState().goBack(); // first one — empty back stack
      const state = useRoomStore.getState();
      expect(state.activeRoomId).toBe(A);
      expect(state.backStack).toEqual([]);
      expect(state.forwardStack).toEqual([]);
    });

    it("goForward is a no-op when the forward stack is empty", () => {
      useRoomStore.getState().setActiveRoom(A);
      useRoomStore.getState().goForward();
      expect(useRoomStore.getState().activeRoomId).toBe(A);
    });

    it("reset clears both stacks", () => {
      useRoomStore.getState().setActiveRoom(A);
      useRoomStore.getState().setActiveRoom(B);
      useRoomStore.getState().reset();
      const state = useRoomStore.getState();
      expect(state.backStack).toEqual([]);
      expect(state.forwardStack).toEqual([]);
      expect(state.activeRoomId).toBeNull();
    });
  });
});

describe("syncStore", () => {
  beforeEach(() => {
    useSyncStore.getState().reset();
  });

  it("initial state is STOPPED", () => {
    expect(useSyncStore.getState().syncState).toBe("STOPPED");
  });

  it("setSyncState updates state", () => {
    useSyncStore.getState().setSyncState("SYNCING");
    expect(useSyncStore.getState().syncState).toBe("SYNCING");
  });

  it("setInitialSyncComplete sets flag", () => {
    useSyncStore.getState().setInitialSyncComplete();
    expect(useSyncStore.getState().initialSyncComplete).toBe(true);
  });
});

describe("typingStore", () => {
  beforeEach(() => {
    useTypingStore.getState().reset();
    useTypingStore.getState().setActiveSession(SID);
  });

  it("setTyping adds and removes users", () => {
    useTypingStore.getState().setTyping(SID, "!room", "@alice", true);
    expect(useTypingStore.getState().typing["!room"]).toContain("@alice");
    useTypingStore.getState().setTyping(SID, "!room", "@alice", false);
    expect(useTypingStore.getState().typing["!room"]).not.toContain("@alice");
  });

  it("typing entries are partitioned by sessionId", () => {
    useTypingStore.getState().setTyping("session_a", "!room", "@alice", true);
    useTypingStore.getState().setTyping("session_b", "!room", "@bob", true);
    expect(useTypingStore.getState().getTyping("session_a", "!room")).toEqual(["@alice"]);
    expect(useTypingStore.getState().getTyping("session_b", "!room")).toEqual(["@bob"]);
  });
});
