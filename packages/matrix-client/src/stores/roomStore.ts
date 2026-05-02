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
  rooms: Record<string, RoomData>;
  activeRoomId: string | null;
  /**
   * Browser-style navigation history. Every `setActiveRoom` call pushes
   * the previous activeRoomId onto `backStack` and clears `forwardStack`.
   * `goBack` / `goForward` move between the two.
   */
  backStack: string[];
  forwardStack: string[];

  setActiveRoom: (roomId: string | null) => void;
  goBack: () => void;
  goForward: () => void;
  upsertRoom: (roomId: string, data: Partial<RoomData>) => void;
  removeRoom: (roomId: string) => void;
  addMessage: (roomId: string, event: SerializedMatrixEvent) => void;
  prependMessages: (roomId: string, events: SerializedMatrixEvent[]) => void;
  setUnreadCount: (roomId: string, count: number, highlight: number) => void;
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

export const useRoomStore = create<RoomStoreState>()(
  immer((set) => ({
    rooms: {},
    activeRoomId: null,
    backStack: [],
    forwardStack: [],

    setActiveRoom: (roomId) =>
      set((s) => {
        if (s.activeRoomId === roomId) return;
        // Pushing the *current* room before switching means goBack() will
        // return to it. New navigation always invalidates the forward
        // stack — same semantics as a browser.
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

    upsertRoom: (roomId, data) =>
      set((s) => {
        if (!s.rooms[roomId]) {
          s.rooms[roomId] = createDefaultRoom(roomId);
        }
        Object.assign(s.rooms[roomId], data);
      }),

    removeRoom: (roomId) =>
      set((s) => {
        delete s.rooms[roomId];
        if (s.activeRoomId === roomId) s.activeRoomId = null;
      }),

    addMessage: (roomId, event) =>
      set((s) => {
        if (!s.rooms[roomId]) s.rooms[roomId] = createDefaultRoom(roomId);
        const room = s.rooms[roomId];
        if (!room.timeline.some((e) => e.eventId === event.eventId)) {
          room.timeline.push(event);
          room.lastMessage = event;
          room.lastActivityTs = event.timestamp;
        }
      }),

    prependMessages: (roomId, events) =>
      set((s) => {
        if (!s.rooms[roomId]) return;
        const existing = new Set(s.rooms[roomId].timeline.map((e) => e.eventId));
        const newEvents = events.filter((e) => !existing.has(e.eventId));
        s.rooms[roomId].timeline.unshift(...newEvents);
      }),

    setUnreadCount: (roomId, count, highlight) =>
      set((s) => {
        if (s.rooms[roomId]) {
          s.rooms[roomId].unreadCount = count;
          s.rooms[roomId].highlightCount = highlight;
        }
      }),

    reset: () =>
      set({
        rooms: {},
        activeRoomId: null,
        backStack: [],
        forwardStack: [],
      }),
  }))
);
