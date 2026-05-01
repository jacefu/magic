import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { useRoomMembersMock } = vi.hoisted(() => ({
  useRoomMembersMock: vi.fn(),
}));

vi.mock("../../src/hooks/useRoomMembers.js", () => ({
  useRoomMembers: useRoomMembersMock,
}));

import { useMentionAutocomplete } from "../../src/hooks/useMentionAutocomplete.js";
import type { RoomMember } from "../../src/hooks/useRoomMembers.js";

const ROOM_ID = "!r:example.com";

function makeMember(overrides: Partial<RoomMember> = {}): RoomMember {
  return {
    userId: "@alice:example.com",
    displayName: "alice",
    avatarMxc: null,
    isAgent: false,
    agentInfo: {
      isAgent: false,
      runtime: null,
      role: null,
      source: "none",
      tagLabel: null,
      tagBg: null,
      tagColor: null,
      nameColor: "#DBDEE1",
    },
    powerLevel: 0,
    ...overrides,
  };
}

beforeEach(() => {
  useRoomMembersMock.mockReset();
});

describe("useMentionAutocomplete", () => {
  it("is closed when there is no @ before the cursor", () => {
    useRoomMembersMock.mockReturnValue([makeMember()]);
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        roomId: ROOM_ID,
        inputValue: "hello world",
        cursorPosition: 11,
      }),
    );
    expect(result.current.isOpen).toBe(false);
    expect(result.current.candidates).toEqual([]);
  });

  it("opens when typing @ at the start of input", () => {
    useRoomMembersMock.mockReturnValue([makeMember()]);
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        roomId: ROOM_ID,
        inputValue: "@",
        cursorPosition: 1,
      }),
    );
    expect(result.current.isOpen).toBe(true);
    // Empty query yields room mention + user candidate
    expect(result.current.candidates).toHaveLength(2);
    expect(result.current.candidates[0].type).toBe("room");
  });

  it("opens when typing @ after whitespace", () => {
    useRoomMembersMock.mockReturnValue([makeMember()]);
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        roomId: ROOM_ID,
        inputValue: "hello @",
        cursorPosition: 7,
      }),
    );
    expect(result.current.isOpen).toBe(true);
  });

  it("does NOT open for @ inside an email-like token (no preceding whitespace)", () => {
    useRoomMembersMock.mockReturnValue([makeMember()]);
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        roomId: ROOM_ID,
        inputValue: "user@",
        cursorPosition: 5,
      }),
    );
    expect(result.current.isOpen).toBe(false);
  });

  it("filters candidates by query string (case-insensitive)", () => {
    useRoomMembersMock.mockReturnValue([
      makeMember({ userId: "@alice:x", displayName: "Alice" }),
      makeMember({ userId: "@bob:x", displayName: "Bob" }),
    ]);
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        roomId: ROOM_ID,
        inputValue: "@bo",
        cursorPosition: 3,
      }),
    );
    const userCandidates = result.current.candidates.filter(
      (c) => c.type === "user",
    );
    expect(userCandidates).toHaveLength(1);
    expect(userCandidates[0].member?.displayName).toBe("Bob");
  });

  it("navigateDown wraps from last to first", () => {
    useRoomMembersMock.mockReturnValue([
      makeMember({ userId: "@a:x", displayName: "a" }),
      makeMember({ userId: "@b:x", displayName: "b" }),
    ]);
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        roomId: ROOM_ID,
        inputValue: "@",
        cursorPosition: 1,
      }),
    );
    act(() => result.current.navigateDown());
    act(() => result.current.navigateDown());
    act(() => result.current.navigateDown());
    expect(result.current.selectedIndex).toBe(0);
  });

  it("navigateUp wraps from first to last", () => {
    useRoomMembersMock.mockReturnValue([
      makeMember({ userId: "@a:x", displayName: "a" }),
    ]);
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        roomId: ROOM_ID,
        inputValue: "@",
        cursorPosition: 1,
      }),
    );
    act(() => result.current.navigateUp());
    expect(result.current.selectedIndex).toBe(result.current.candidates.length - 1);
  });

  it("selectCandidate inserts user mention placeholder at trigger position", () => {
    useRoomMembersMock.mockReturnValue([
      makeMember({ userId: "@alice:x", displayName: "alice" }),
    ]);
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        roomId: ROOM_ID,
        inputValue: "hi @ali",
        cursorPosition: 7,
      }),
    );
    // query "ali" doesn't match "全体"/"all"/"room", so room candidate is
    // suppressed and alice is at index 0
    const inserted = result.current.selectCandidate(0);
    expect(inserted).not.toBeNull();
    expect(inserted!.newValue).toBe("hi [@alice](@alice:x) ");
    expect(inserted!.newCursorPos).toBe("hi [@alice](@alice:x) ".length);
  });

  it("selectCandidate inserts @全体 for room candidate", () => {
    useRoomMembersMock.mockReturnValue([]);
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        roomId: ROOM_ID,
        inputValue: "@",
        cursorPosition: 1,
      }),
    );
    const inserted = result.current.selectCandidate(0);
    expect(inserted).not.toBeNull();
    expect(inserted!.newValue).toBe("@全体 ");
  });

  it("limits user candidates to 10 max", () => {
    const lots = Array.from({ length: 15 }, (_, i) =>
      makeMember({
        userId: `@u${i}:x`,
        displayName: `u${i}`,
      }),
    );
    useRoomMembersMock.mockReturnValue(lots);
    const { result } = renderHook(() =>
      useMentionAutocomplete({
        roomId: ROOM_ID,
        inputValue: "@u",
        cursorPosition: 2,
      }),
    );
    const userCandidates = result.current.candidates.filter(
      (c) => c.type === "user",
    );
    expect(userCandidates.length).toBe(10);
  });
});
