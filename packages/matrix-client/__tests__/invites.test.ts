import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionClient = {
  joinRoom: vi.fn(),
  leave: vi.fn(),
  getIgnoredUsers: vi.fn(() => [] as string[]),
  setIgnoredUsers: vi.fn(),
};

vi.mock("../src/session-manager.js", () => ({
  getSessionClient: vi.fn(() => sessionClient),
}));

import {
  acceptInvite,
  declineInvite,
  declineAndBlockInvite,
  acceptAllInvitesFrom,
} from "../src/invites.js";
import {
  useInviteStore,
  type RoomInvite,
} from "../src/stores/inviteStore.js";

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

beforeEach(() => {
  useInviteStore.getState().reset();
  sessionClient.joinRoom.mockReset();
  sessionClient.leave.mockReset();
  sessionClient.getIgnoredUsers.mockReset();
  sessionClient.getIgnoredUsers.mockReturnValue([]);
  sessionClient.setIgnoredUsers.mockReset();
});

describe("acceptInvite", () => {
  it("calls joinRoom and removes the invite on success", async () => {
    useInviteStore.getState().addInvite(makeInvite());
    sessionClient.joinRoom.mockResolvedValue(undefined);

    await acceptInvite("!room_a:server.example");

    expect(sessionClient.joinRoom).toHaveBeenCalledWith("!room_a:server.example");
    expect(useInviteStore.getState().invites["!room_a:server.example"]).toBeUndefined();
  });

  it("restores pending status and rethrows on failure", async () => {
    useInviteStore.getState().addInvite(makeInvite());
    sessionClient.joinRoom.mockRejectedValue(new Error("forbidden"));

    await expect(acceptInvite("!room_a:server.example")).rejects.toThrow(
      "forbidden",
    );
    expect(
      useInviteStore.getState().invites["!room_a:server.example"]?.status,
    ).toBe("pending");
  });

  it("throws when no invite record exists for the roomId", async () => {
    await expect(acceptInvite("!ghost:x")).rejects.toThrow(/No pending invite/);
  });
});

describe("declineInvite", () => {
  it("calls leave and removes the invite", async () => {
    useInviteStore.getState().addInvite(makeInvite());
    sessionClient.leave.mockResolvedValue(undefined);

    await declineInvite("!room_a:server.example");

    expect(sessionClient.leave).toHaveBeenCalledWith("!room_a:server.example");
    expect(useInviteStore.getState().invites["!room_a:server.example"]).toBeUndefined();
  });
});

describe("declineAndBlockInvite", () => {
  it("leaves the room and adds the inviter to ignored users", async () => {
    useInviteStore
      .getState()
      .addInvite(makeInvite({ inviterId: "@spammer:server.example" }));
    sessionClient.leave.mockResolvedValue(undefined);
    sessionClient.getIgnoredUsers.mockReturnValue(["@old:x"]);
    sessionClient.setIgnoredUsers.mockResolvedValue(undefined);

    await declineAndBlockInvite("!room_a:server.example");

    expect(sessionClient.leave).toHaveBeenCalled();
    expect(sessionClient.setIgnoredUsers).toHaveBeenCalledWith([
      "@old:x",
      "@spammer:server.example",
    ]);
    expect(useInviteStore.getState().invites["!room_a:server.example"]).toBeUndefined();
  });

  it("does not duplicate an already-ignored inviter", async () => {
    useInviteStore
      .getState()
      .addInvite(makeInvite({ inviterId: "@spammer:server.example" }));
    sessionClient.leave.mockResolvedValue(undefined);
    sessionClient.getIgnoredUsers.mockReturnValue(["@spammer:server.example"]);

    await declineAndBlockInvite("!room_a:server.example");

    expect(sessionClient.setIgnoredUsers).not.toHaveBeenCalled();
  });
});

describe("acceptAllInvitesFrom", () => {
  it("accepts every pending invite from the given inviter", async () => {
    useInviteStore.getState().addInvite(
      makeInvite({ roomId: "!a:x", inviterId: "@manager:hiclaw" }),
    );
    useInviteStore.getState().addInvite(
      makeInvite({ roomId: "!b:x", inviterId: "@manager:hiclaw" }),
    );
    useInviteStore.getState().addInvite(
      makeInvite({ roomId: "!c:x", inviterId: "@other:hiclaw" }),
    );
    sessionClient.joinRoom.mockResolvedValue(undefined);

    await acceptAllInvitesFrom("@manager:hiclaw");

    expect(sessionClient.joinRoom).toHaveBeenCalledWith("!a:x");
    expect(sessionClient.joinRoom).toHaveBeenCalledWith("!b:x");
    expect(sessionClient.joinRoom).not.toHaveBeenCalledWith("!c:x");
  });
});
