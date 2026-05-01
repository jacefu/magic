import { describe, it, expect, vi, beforeEach } from "vitest";

const { hasClientMock, getClientMock, getUserMock } = vi.hoisted(() => ({
  hasClientMock: vi.fn(),
  getClientMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock("@magic/matrix-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@magic/matrix-client")>();
  return {
    ...actual,
    hasClient: hasClientMock,
    getClient: getClientMock,
  };
});

import {
  getUserPresence,
  getPresenceColor,
  getPresenceLabel,
} from "../../src/lib/presenceUtils.js";

beforeEach(() => {
  hasClientMock.mockReset();
  getClientMock.mockReset();
  getUserMock.mockReset();
  hasClientMock.mockReturnValue(true);
  getClientMock.mockReturnValue({ getUser: getUserMock });
});

describe("getUserPresence", () => {
  it("returns offline when there is no Matrix client yet", () => {
    hasClientMock.mockReturnValue(false);
    expect(getUserPresence("@a:x")).toBe("offline");
  });

  it("returns offline when SDK has no User record", () => {
    getUserMock.mockReturnValue(null);
    expect(getUserPresence("@a:x")).toBe("offline");
  });

  it("maps SDK 'online' → online", () => {
    getUserMock.mockReturnValue({ presence: "online" });
    expect(getUserPresence("@a:x")).toBe("online");
  });

  it("maps SDK 'unavailable' → idle", () => {
    getUserMock.mockReturnValue({ presence: "unavailable" });
    expect(getUserPresence("@a:x")).toBe("idle");
  });

  it("maps SDK 'busy' → online", () => {
    getUserMock.mockReturnValue({ presence: "busy" });
    expect(getUserPresence("@a:x")).toBe("online");
  });

  it("maps SDK 'offline' → offline", () => {
    getUserMock.mockReturnValue({ presence: "offline" });
    expect(getUserPresence("@a:x")).toBe("offline");
  });

  it("returns offline when SDK throws", () => {
    getClientMock.mockImplementation(() => {
      throw new Error("not initialized");
    });
    expect(getUserPresence("@a:x")).toBe("offline");
  });
});

describe("getPresenceColor", () => {
  it("returns the design-system green/yellow/grey hexes", () => {
    expect(getPresenceColor("online")).toBe("#23A55A");
    expect(getPresenceColor("idle")).toBe("#F0B232");
    expect(getPresenceColor("offline")).toBe("#6D6F78");
  });
});

describe("getPresenceLabel", () => {
  it("returns Chinese labels for each status", () => {
    expect(getPresenceLabel("online")).toBe("在线");
    expect(getPresenceLabel("idle")).toBe("空闲");
    expect(getPresenceLabel("offline")).toBe("离线");
  });
});
