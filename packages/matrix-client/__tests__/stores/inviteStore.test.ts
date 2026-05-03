import { beforeEach, describe, expect, it } from "vitest";
import {
  useInviteStore,
  type RoomInvite,
} from "../../src/stores/inviteStore.js";

beforeEach(() => {
  useInviteStore.getState().reset();
});

function makeInvite(overrides: Partial<RoomInvite> = {}): RoomInvite {
  return {
    roomId: "!room_a:server.example",
    roomName: "Room A",
    roomAvatarMxc: null,
    inviterId: "@alice:server.example",
    inviterName: "alice",
    isDirect: false,
    isEncrypted: false,
    timestamp: 1000,
    status: "pending",
    sessionId: "session_a",
    ...overrides,
  };
}

describe("inviteStore", () => {
  it("addInvite stores the record under its roomId", () => {
    useInviteStore.getState().addInvite(makeInvite());
    expect(useInviteStore.getState().invites["!room_a:server.example"]).toMatchObject({
      roomName: "Room A",
      status: "pending",
    });
  });

  it("removeInvite drops the record and is a no-op for unknown ids", () => {
    useInviteStore.getState().addInvite(makeInvite());
    useInviteStore.getState().removeInvite("!ghost:x");
    expect(useInviteStore.getState().invites["!room_a:server.example"]).toBeDefined();
    useInviteStore.getState().removeInvite("!room_a:server.example");
    expect(useInviteStore.getState().invites["!room_a:server.example"]).toBeUndefined();
  });

  it("updateInviteStatus mutates only the status field", () => {
    useInviteStore.getState().addInvite(makeInvite());
    useInviteStore.getState().updateInviteStatus("!room_a:server.example", "accepting");
    const current = useInviteStore.getState().invites["!room_a:server.example"];
    expect(current.status).toBe("accepting");
    expect(current.roomName).toBe("Room A");
  });

  it("updateInviteStatus is a no-op for unknown ids", () => {
    useInviteStore.getState().updateInviteStatus("!ghost:x", "declining");
    expect(useInviteStore.getState().invites).toEqual({});
  });

  it("getInvitesForSession filters by sessionId and sorts newest-first", () => {
    useInviteStore.getState().addInvite(
      makeInvite({ roomId: "!a:x", sessionId: "session_a", timestamp: 1000 }),
    );
    useInviteStore.getState().addInvite(
      makeInvite({ roomId: "!b:x", sessionId: "session_a", timestamp: 3000 }),
    );
    useInviteStore.getState().addInvite(
      makeInvite({ roomId: "!c:x", sessionId: "session_b", timestamp: 2000 }),
    );

    const aList = useInviteStore.getState().getInvitesForSession("session_a");
    expect(aList.map((i) => i.roomId)).toEqual(["!b:x", "!a:x"]);
    const bList = useInviteStore.getState().getInvitesForSession("session_b");
    expect(bList.map((i) => i.roomId)).toEqual(["!c:x"]);
  });

  it("getInviteCount totals across or within a session", () => {
    useInviteStore.getState().addInvite(
      makeInvite({ roomId: "!a:x", sessionId: "session_a" }),
    );
    useInviteStore.getState().addInvite(
      makeInvite({ roomId: "!b:x", sessionId: "session_b" }),
    );
    expect(useInviteStore.getState().getInviteCount()).toBe(2);
    expect(useInviteStore.getState().getInviteCount("session_a")).toBe(1);
  });

  it("removeInvitesForSession clears one session's invites", () => {
    useInviteStore.getState().addInvite(
      makeInvite({ roomId: "!a:x", sessionId: "session_a" }),
    );
    useInviteStore.getState().addInvite(
      makeInvite({ roomId: "!b:x", sessionId: "session_b" }),
    );
    useInviteStore.getState().removeInvitesForSession("session_a");
    expect(useInviteStore.getState().invites["!a:x"]).toBeUndefined();
    expect(useInviteStore.getState().invites["!b:x"]).toBeDefined();
  });

  it("reset wipes all invites", () => {
    useInviteStore.getState().addInvite(makeInvite());
    useInviteStore.getState().reset();
    expect(useInviteStore.getState().invites).toEqual({});
  });
});
