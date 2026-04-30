import { describe, it, expect, beforeEach } from "vitest";
import { useRoomStore } from "../src/stores/roomStore.js";
import { useSyncStore } from "../src/stores/syncStore.js";
import { useTypingStore } from "../src/stores/typingStore.js";
import type { SerializedMatrixEvent } from "@magic/shared-types";

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
  });

  it("upsertRoom creates room if missing", () => {
    useRoomStore.getState().upsertRoom("!room:example.com", { name: "Test" });
    const room = useRoomStore.getState().rooms["!room:example.com"];
    expect(room.name).toBe("Test");
  });

  it("addMessage deduplicates events", () => {
    const evt = makeEvent("$evt1");
    useRoomStore.getState().addMessage("!room:example.com", evt);
    useRoomStore.getState().addMessage("!room:example.com", evt);
    expect(useRoomStore.getState().rooms["!room:example.com"].timeline).toHaveLength(1);
  });

  it("addMessage updates lastMessage", () => {
    useRoomStore.getState().addMessage("!room:example.com", makeEvent("$evt1", 1000));
    useRoomStore.getState().addMessage("!room:example.com", makeEvent("$evt2", 2000));
    expect(useRoomStore.getState().rooms["!room:example.com"].lastMessage?.eventId).toBe("$evt2");
  });

  it("prependMessages prepends without duplicates", () => {
    useRoomStore.getState().addMessage("!room:example.com", makeEvent("$evt2"));
    useRoomStore.getState().prependMessages("!room:example.com", [makeEvent("$evt1"), makeEvent("$evt2")]);
    const timeline = useRoomStore.getState().rooms["!room:example.com"].timeline;
    expect(timeline).toHaveLength(2);
    expect(timeline[0].eventId).toBe("$evt1");
  });

  it("setUnreadCount updates counts", () => {
    useRoomStore.getState().upsertRoom("!room:example.com", {});
    useRoomStore.getState().setUnreadCount("!room:example.com", 5, 2);
    const room = useRoomStore.getState().rooms["!room:example.com"];
    expect(room.unreadCount).toBe(5);
    expect(room.highlightCount).toBe(2);
  });

  it("removeRoom removes room and clears activeRoomId", () => {
    useRoomStore.getState().upsertRoom("!room:example.com", {});
    useRoomStore.getState().setActiveRoom("!room:example.com");
    useRoomStore.getState().removeRoom("!room:example.com");
    expect(useRoomStore.getState().rooms["!room:example.com"]).toBeUndefined();
    expect(useRoomStore.getState().activeRoomId).toBeNull();
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
  });

  it("setTyping adds and removes users", () => {
    useTypingStore.getState().setTyping("!room", "@alice", true);
    expect(useTypingStore.getState().typing["!room"]).toContain("@alice");
    useTypingStore.getState().setTyping("!room", "@alice", false);
    expect(useTypingStore.getState().typing["!room"]).not.toContain("@alice");
  });
});
