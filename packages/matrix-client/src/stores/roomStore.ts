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
        if (room.timeline.some((e) => e.eventId === event.eventId)) {
          relinkActiveRooms(s);
          return;
        }

        // Matrix /sync can deliver events out of timestamp order
        // (federation delay, late delivery from another device,
        // re-bridged history). Naïve `push` would leave a 20:47
        // message sitting *after* a 20:53 message in the array.
        // Hot path: ~all live events arrive in order — append.
        // Cold path: binary-search the correct insertion index.
        const tail = room.timeline[room.timeline.length - 1];
        if (!tail || event.timestamp >= tail.timestamp) {
          room.timeline.push(event);
        } else {
          let lo = 0;
          let hi = room.timeline.length;
          while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (room.timeline[mid]!.timestamp <= event.timestamp) lo = mid + 1;
            else hi = mid;
          }
          room.timeline.splice(lo, 0, event);
        }

        // Track the chronologically newest event, not whichever was
        // inserted most recently — otherwise a late-arriving older
        // event would clobber `lastMessage`.
        if (!room.lastMessage || event.timestamp >= room.lastMessage.timestamp) {
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
        if (newEvents.length === 0) {
          relinkActiveRooms(s);
          return;
        }
        // Pagination usually returns history in order (older → newer)
        // and prepends to a tail-sorted timeline, so the simple
        // unshift is correct most of the time. Re-sort defensively
        // anyway — Matrix backfill can still hand back events whose
        // timestamps interleave with what we already have (edits,
        // late state events).
        partition[roomId].timeline.unshift(...newEvents);
        partition[roomId].timeline.sort((a, b) => a.timestamp - b.timestamp);
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
