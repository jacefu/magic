import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRoom = {
  roomId: "!room1:example.com",
  findEventById: vi.fn(),
  getLiveTimeline: vi.fn(),
  getUnreadNotificationCount: vi.fn().mockReturnValue(0),
};

const mockClient = {
  initRustCrypto: vi.fn().mockResolvedValue(undefined),
  stopClient: vi.fn(),
  removeAllListeners: vi.fn(),
  createRoom: vi.fn().mockResolvedValue({ room_id: "!newroom:example.com" }),
  joinRoom: vi.fn().mockResolvedValue({ roomId: "!joined:example.com" }),
  leave: vi.fn().mockResolvedValue(undefined),
  invite: vi.fn().mockResolvedValue(undefined),
  getRooms: vi.fn().mockReturnValue([mockRoom]),
  getRoom: vi.fn().mockReturnValue(mockRoom),
};

vi.mock("matrix-js-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("matrix-js-sdk")>();
  return {
    ...actual,
    createClient: vi.fn(() => mockClient),
  };
});

import { initClient, destroyClient } from "../src/client.js";
import { createRoom, joinRoom, leaveRoom, inviteUser, getRooms, getRoom } from "../src/rooms.js";

describe("rooms", () => {
  beforeEach(async () => {
    await destroyClient();
    await initClient({ homeserver: "https://matrix.example.com", enableCrypto: false });
    vi.clearAllMocks();
    mockClient.createRoom.mockResolvedValue({ room_id: "!newroom:example.com" });
    mockClient.joinRoom.mockResolvedValue({ roomId: "!joined:example.com" });
    mockClient.getRooms.mockReturnValue([mockRoom]);
    mockClient.getRoom.mockReturnValue(mockRoom);
  });

  it("createRoom returns room_id", async () => {
    const id = await createRoom({ name: "Test Room" });
    expect(id).toBe("!newroom:example.com");
  });

  it("joinRoom returns roomId", async () => {
    const id = await joinRoom("!joined:example.com");
    expect(id).toBe("!joined:example.com");
  });

  it("leaveRoom calls client.leave", async () => {
    await leaveRoom("!room1:example.com");
    expect(mockClient.leave).toHaveBeenCalledWith("!room1:example.com");
  });

  it("inviteUser calls client.invite", async () => {
    await inviteUser("!room1:example.com", "@bob:example.com");
    expect(mockClient.invite).toHaveBeenCalledWith("!room1:example.com", "@bob:example.com");
  });

  it("getRooms returns rooms array", () => {
    const rooms = getRooms();
    expect(rooms).toHaveLength(1);
  });

  it("getRoom returns a room", () => {
    const room = getRoom("!room1:example.com");
    expect(room?.roomId).toBe("!room1:example.com");
  });
});
