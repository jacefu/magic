import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRoomStore } from "@magic/matrix-client";
import type { RoomData } from "@magic/matrix-client";
import { useFilteredRooms } from "../../src/hooks/useFilteredRooms.js";

const dmAlice: RoomData = {
  roomId: "!dm1:example.com",
  name: "Alice",
  topic: "",
  avatarMxc: null,
  memberCount: 2,
  unreadCount: 3,
  highlightCount: 1,
  timeline: [],
  lastMessage: null,
  isEncrypted: false,
  isDirect: true,
  lastActivityTs: 3000,
};

const dmBob: RoomData = {
  roomId: "!dm2:example.com",
  name: "Bob",
  topic: "",
  avatarMxc: null,
  memberCount: 2,
  unreadCount: 0,
  highlightCount: 0,
  timeline: [],
  lastMessage: null,
  isEncrypted: false,
  isDirect: true,
  lastActivityTs: 1000,
};

const groupEngineering: RoomData = {
  roomId: "!group1:example.com",
  name: "Engineering",
  topic: "",
  avatarMxc: null,
  memberCount: 10,
  unreadCount: 0,
  highlightCount: 0,
  timeline: [],
  lastMessage: null,
  isEncrypted: false,
  isDirect: false,
  lastActivityTs: 5000,
};

const groupDesign: RoomData = {
  roomId: "!group2:example.com",
  name: "Design",
  topic: "",
  avatarMxc: null,
  memberCount: 5,
  unreadCount: 2,
  highlightCount: 0,
  timeline: [],
  lastMessage: null,
  isEncrypted: false,
  isDirect: false,
  lastActivityTs: 2000,
};

beforeEach(() => {
  useRoomStore.setState({
    rooms: {
      [dmAlice.roomId]: dmAlice,
      [dmBob.roomId]: dmBob,
      [groupEngineering.roomId]: groupEngineering,
      [groupDesign.roomId]: groupDesign,
    },
    activeRoomId: null,
  });
});

describe("useFilteredRooms", () => {
  it("groups rooms into dm and group sections", () => {
    const { result } = renderHook(() => useFilteredRooms());
    expect(result.current.groups).toHaveLength(2);
    expect(result.current.groups[0].key).toBe("dm");
    expect(result.current.groups[1].key).toBe("group");
  });

  it("places 2-member rooms in the private section", () => {
    const { result } = renderHook(() => useFilteredRooms());
    const dmGroup = result.current.groups.find((g) => g.key === "dm")!;
    expect(dmGroup.rooms.every((r) => r.memberCount === 2)).toBe(true);
  });

  it("places rooms with >2 members in the group section", () => {
    const { result } = renderHook(() => useFilteredRooms());
    const groupSection = result.current.groups.find((g) => g.key === "group")!;
    expect(groupSection.rooms.every((r) => r.memberCount !== 2)).toBe(true);
  });

  it("classifies a 2-member room as DM even when isDirect is false", () => {
    // Matrix's m.direct flag is unreliable across clients; member count is
    // the user-facing source of truth.
    useRoomStore.setState({
      rooms: {
        "!stealthDm:example.com": {
          ...dmAlice,
          roomId: "!stealthDm:example.com",
          name: "StealthDm",
          isDirect: false,
          memberCount: 2,
        },
      },
      activeRoomId: null,
    });
    const { result } = renderHook(() => useFilteredRooms());
    const dmGroup = result.current.groups.find((g) => g.key === "dm");
    expect(dmGroup).toBeDefined();
    expect(dmGroup!.rooms[0].name).toBe("StealthDm");
  });

  it("classifies a room with >2 members as group even when isDirect is true", () => {
    useRoomStore.setState({
      rooms: {
        "!misflaggedGroup:example.com": {
          ...groupEngineering,
          roomId: "!misflaggedGroup:example.com",
          name: "MisflaggedGroup",
          isDirect: true,
          memberCount: 4,
        },
      },
      activeRoomId: null,
    });
    const { result } = renderHook(() => useFilteredRooms());
    const groupSection = result.current.groups.find((g) => g.key === "group");
    expect(groupSection).toBeDefined();
    expect(groupSection!.rooms[0].name).toBe("MisflaggedGroup");
  });

  it("sorts unread rooms before read rooms within a section", () => {
    const { result } = renderHook(() => useFilteredRooms());
    const dmGroup = result.current.groups.find((g) => g.key === "dm")!;
    expect(dmGroup.rooms[0].roomId).toBe(dmAlice.roomId); // unread first
    expect(dmGroup.rooms[1].roomId).toBe(dmBob.roomId);   // read second
  });

  it("sorts by lastActivityTs descending within same unread tier", () => {
    const { result } = renderHook(() => useFilteredRooms());
    const groupSection = result.current.groups.find((g) => g.key === "group")!;
    // Design (unread) before Engineering (read), regardless of ts
    expect(groupSection.rooms[0].roomId).toBe(groupDesign.roomId);
    expect(groupSection.rooms[1].roomId).toBe(groupEngineering.roomId);
  });

  it("filters rooms by search query case-insensitively", () => {
    const { result } = renderHook(() => useFilteredRooms());
    act(() => result.current.setSearchQuery("alice"));
    const allRooms = result.current.groups.flatMap((g) => g.rooms);
    expect(allRooms).toHaveLength(1);
    expect(allRooms[0].name).toBe("Alice");
  });

  it("returns all rooms when search query is cleared", () => {
    const { result } = renderHook(() => useFilteredRooms());
    act(() => result.current.setSearchQuery("alice"));
    act(() => result.current.setSearchQuery(""));
    const allRooms = result.current.groups.flatMap((g) => g.rooms);
    expect(allRooms).toHaveLength(4);
  });

  it("returns empty groups when no rooms match the search", () => {
    const { result } = renderHook(() => useFilteredRooms());
    act(() => result.current.setSearchQuery("zzznomatch"));
    expect(result.current.groups).toHaveLength(0);
  });

  it("toggleSection collapses a section", () => {
    const { result } = renderHook(() => useFilteredRooms());
    expect(result.current.groups[0].collapsed).toBe(false);
    act(() => result.current.toggleSection("dm"));
    expect(result.current.groups[0].collapsed).toBe(true);
  });

  it("toggleSection re-expands a collapsed section", () => {
    const { result } = renderHook(() => useFilteredRooms());
    act(() => result.current.toggleSection("dm"));
    act(() => result.current.toggleSection("dm"));
    expect(result.current.groups[0].collapsed).toBe(false);
  });

  it("computes totalUnreadCount across all rooms", () => {
    const { result } = renderHook(() => useFilteredRooms());
    // dmAlice: 3 + groupDesign: 2 = 5
    expect(result.current.totalUnreadCount).toBe(5);
  });
});
