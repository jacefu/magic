import { describe, it, expect, vi, beforeEach } from "vitest";

const { hasClientMock, getRoomMock, getJoinedMembersMock } = vi.hoisted(() => ({
  hasClientMock: vi.fn(),
  getRoomMock: vi.fn(),
  getJoinedMembersMock: vi.fn(),
}));

vi.mock("@magic/matrix-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@magic/matrix-client")>();
  return {
    ...actual,
    hasClient: hasClientMock,
    getClient: () => ({ getRoom: getRoomMock }),
  };
});

import { resolveMentionsToPlaceholders } from "../../src/hooks/useComposer.js";

const ROOM = "!r:example.com";

beforeEach(() => {
  hasClientMock.mockReset();
  getRoomMock.mockReset();
  getJoinedMembersMock.mockReset();
  hasClientMock.mockReturnValue(true);
  getRoomMock.mockReturnValue({ getJoinedMembers: getJoinedMembersMock });
});

function setMembers(members: Array<{ userId: string; name: string }>) {
  getJoinedMembersMock.mockReturnValue(
    members.map((m) => ({
      userId: m.userId,
      name: m.name,
    })),
  );
}

describe("resolveMentionsToPlaceholders", () => {
  it("returns text unchanged when there is no Matrix client", () => {
    hasClientMock.mockReturnValue(false);
    expect(resolveMentionsToPlaceholders("hi @alice", ROOM)).toBe("hi @alice");
  });

  it("returns text unchanged when the room isn't found", () => {
    getRoomMock.mockReturnValue(null);
    expect(resolveMentionsToPlaceholders("hi @alice", ROOM)).toBe("hi @alice");
  });

  it("returns text unchanged when there are no joined members", () => {
    setMembers([]);
    expect(resolveMentionsToPlaceholders("hi @alice", ROOM)).toBe("hi @alice");
  });

  it("rewrites a plain @name into the placeholder syntax", () => {
    setMembers([{ userId: "@alice:example.com", name: "alice" }]);
    expect(resolveMentionsToPlaceholders("hi @alice", ROOM)).toBe(
      "hi [@alice](@alice:example.com)",
    );
  });

  it("handles display names with spaces and emoji", () => {
    setMembers([
      { userId: "@manager:matrix-local.hiclaw.io:18080", name: "manager 💕" },
    ]);
    expect(
      resolveMentionsToPlaceholders("@manager 💕 hi", ROOM),
    ).toBe("[@manager 💕](@manager:matrix-local.hiclaw.io:18080) hi");
  });

  it("does not match @ inside an email address", () => {
    setMembers([{ userId: "@alice:example.com", name: "example.com" }]);
    expect(
      resolveMentionsToPlaceholders("ping me at me@example.com", ROOM),
    ).toBe("ping me at me@example.com");
  });

  it("longest member name wins on prefix collisions", () => {
    setMembers([
      { userId: "@a:x", name: "alice" },
      { userId: "@b:x", name: "alice_two" },
    ]);
    const out = resolveMentionsToPlaceholders("@alice_two hi", ROOM);
    expect(out).toContain("[@alice_two](@b:x)");
    expect(out).not.toContain("[@alice]");
  });

  it("does not match a partial name followed by alphanumeric", () => {
    setMembers([{ userId: "@a:x", name: "alice" }]);
    expect(resolveMentionsToPlaceholders("@alicia is here", ROOM)).toBe(
      "@alicia is here",
    );
  });
});
