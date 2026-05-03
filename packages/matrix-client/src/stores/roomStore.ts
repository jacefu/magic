import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { SerializedMatrixEvent } from "@magic/shared-types";

export interface RoomData {
  roomId: string;
  name: string;
  topic: string;
  avatarMxc: string | null;
  memberCount: number;
  unreadCount: number;
  highlightCount: number;
  timeline: SerializedMatrixEvent[];
  lastMessage: SerializedMatrixEvent | null;
  isEncrypted: boolean;
  isDirect: boolean;
  lastActivityTs: number;
}

interface RoomStoreState {
  /**
   * Per-session partition of room state. Spec 017 — each Matrix
   * homeserver session writes to its own slice so events from one
   * server can never leak into another's room list.
   *
   * `sessionRooms[sessionId]` is the source of truth for that session.
   */
  sessionRooms: Record<string, Record<string, RoomData>>;
  /**
   * Mirror of `sessionRooms[activeSessionId]`. Maintained so existing
   * components that subscribe via `useRoomStore((s) => s.rooms[id])`
   * keep working unchanged. Within an immer producer the assignment
   * `s.rooms = s.sessionRooms[id]` makes them aliases — modifying one
   * modifies the other.
   */
  rooms: Record<string, RoomData>;
  /** Id of the session whose data the UI currently shows. */
  activeSessionId: string | null;
  activeRoomId: string | null;
  /** Browser-style navigation history (per app, shared across sessions). */
  backStack: string[];
  forwardStack: string[];

  // ---- session lifecycle ----
  initSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  removeSession: (sessionId: string) => void;

  // ---- room navigation ----
  setActiveRoom: (roomId: string | null) => void;
  goBack: () => void;
  goForward: () => void;

  // ---- per-session writes ----
  upsertRoom: (
    sessionId: string,
    roomId: string,
    data: Partial<RoomData>,
  ) => void;
  removeRoom: (sessionId: string, roomId: string) => void;
  addMessage: (
    sessionId: string,
    roomId: string,
    event: SerializedMatrixEvent,
  ) => void;
  prependMessages: (
    sessionId: string,
    roomId: string,
    events: SerializedMatrixEvent[],
  ) => void;
  setUnreadCount: (
    sessionId: string,
    roomId: string,
    count: number,
    highlight: number,
  ) => void;

  reset: () => void;
}

function createDefaultRoom(roomId: string): RoomData {
  return {
    roomId,
    name: "",
    topic: "",
    avatarMxc: null,
    memberCount: 0,
    unreadCount: 0,
    highlightCount: 0,
    timeline: [],
    lastMessage: null,
    isEncrypted: false,
    isDirect: false,
    lastActivityTs: 0,
  };
}

/**
 * Re-establish the alias between `s.rooms` and `s.sessionRooms[active]`.
 * Call this after any mutation that might have replaced the active
 * session's record (createSession, removeSession, setActiveSession).
 * Mutations that go *through* `s.rooms` (e.g. `s.rooms[roomId] = …`)
 * already propagate to `s.sessionRooms[active]` because they share the
 * same draft proxy under immer.
 */
function relinkActiveRooms(s: RoomStoreState): void {
  if (s.activeSessionId && s.sessionRooms[s.activeSessionId]) {
    s.rooms = s.sessionRooms[s.activeSessionId];
  } else {
    s.rooms = {};
  }
}

export const useRoomStore = create<RoomStoreState>()(
  immer((set) => ({
    sessionRooms: {},
    rooms: {},
    activeSessionId: null,
    activeRoomId: null,
    backStack: [],
    forwardStack: [],

    initSession: (sessionId) =>
      set((s) => {
        if (!s.sessionRooms[sessionId]) {
          s.sessionRooms[sessionId] = {};
        }
        relinkActiveRooms(s);
      }),

    setActiveSession: (sessionId) =>
      set((s) => {
        if (s.activeSessionId === sessionId) return;
        s.activeSessionId = sessionId;
        s.activeRoomId = null;
        s.backStack = [];
        s.forwardStack = [];
        if (sessionId && !s.sessionRooms[sessionId]) {
          s.sessionRooms[sessionId] = {};
        }
        relinkActiveRooms(s);
      }),

    removeSession: (sessionId) =>
      set((s) => {
        delete s.sessionRooms[sessionId];
        if (s.activeSessionId === sessionId) {
          s.activeSessionId = Object.keys(s.sessionRooms)[0] ?? null;
          s.activeRoomId = null;
          s.backStack = [];
          s.forwardStack = [];
        }
        relinkActiveRooms(s);
      }),

    setActiveRoom: (roomId) =>
      set((s) => {
        if (s.activeRoomId === roomId) return;
        if (s.activeRoomId !== null) s.backStack.push(s.activeRoomId);
        s.forwardStack = [];
        s.activeRoomId = roomId;
      }),

    goBack: () =>
      set((s) => {
        if (s.backStack.length === 0) return;
        const prev = s.backStack.pop()!;
        if (s.activeRoomId !== null) s.forwardStack.push(s.activeRoomId);
        s.activeRoomId = prev;
      }),

    goForward: () =>
      set((s) => {
        if (s.forwardStack.length === 0) return;
        const next = s.forwardStack.pop()!;
        if (s.activeRoomId !== null) s.backStack.push(s.activeRoomId);
        s.activeRoomId = next;
      }),

    upsertRoom: (sessionId, roomId, data) =>
      set((s) => {
        if (!s.sessionRooms[sessionId]) s.sessionRooms[sessionId] = {};
        if (!s.sessionRooms[sessionId][roomId]) {
          s.sessionRooms[sessionId][roomId] = createDefaultRoom(roomId);
        }
        Object.assign(s.sessionRooms[sessionId][roomId], data);
        relinkActiveRooms(s);
      }),

    removeRoom: (sessionId, roomId) =>
      set((s) => {
        if (s.sessionRooms[sessionId]) {
          delete s.sessionRooms[sessionId][roomId];
        }
        if (
          s.activeSessionId === sessionId &&
          s.activeRoomId === roomId
        ) {
          s.activeRoomId = null;
        }
        relinkActiveRooms(s);
      }),

    addMessage: (sessionId, roomId, event) =>
      set((s) => {
        if (!s.sessionRooms[sessionId]) s.sessionRooms[sessionId] = {};
        const partition = s.sessionRooms[sessionId];
        if (!partition[roomId]) partition[roomId] = createDefaultRoom(roomId);
        const room = partition[roomId];
        if (!room.timeline.some((e) => e.eventId === event.eventId)) {
          room.timeline.push(event);
          room.lastMessage = event;
          room.lastActivityTs = event.timestamp;
        }
        relinkActiveRooms(s);
      }),

    prependMessages: (sessionId, roomId, events) =>
      set((s) => {
        const partition = s.sessionRooms[sessionId];
        if (!partition?.[roomId]) return;
        const existing = new Set(
          partition[roomId].timeline.map((e) => e.eventId),
        );
        const newEvents = events.filter((e) => !existing.has(e.eventId));
        partition[roomId].timeline.unshift(...newEvents);
        relinkActiveRooms(s);
      }),

    setUnreadCount: (sessionId, roomId, count, highlight) =>
      set((s) => {
        const partition = s.sessionRooms[sessionId];
        if (partition?.[roomId]) {
          partition[roomId].unreadCount = count;
          partition[roomId].highlightCount = highlight;
        }
        relinkActiveRooms(s);
      }),

    reset: () =>
      set({
        sessionRooms: {},
        rooms: {},
        activeSessionId: null,
        activeRoomId: null,
        backStack: [],
        forwardStack: [],
      }),
  })),
);
