import { create } from "zustand";

export type NotificationLevel = "all" | "mentions" | "mute";

interface NotificationStoreState {
  /** Global notification level. */
  level: NotificationLevel;
  /** Do-not-disturb mode — suppresses all notifications + sounds. */
  dnd: boolean;
  /** Whether sound effects play on notification. */
  soundEnabled: boolean;
  /** Per-room mute list. Muted rooms never trigger notifications. */
  mutedRooms: Set<string>;
  /** Aggregate unread count across non-muted rooms (drives the tray badge). */
  totalUnreadCount: number;
  /** Aggregate @mention count across non-muted rooms. */
  totalMentionCount: number;

  setLevel: (level: NotificationLevel) => void;
  setDnd: (dnd: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  muteRoom: (roomId: string) => void;
  unmuteRoom: (roomId: string) => void;
  isRoomMuted: (roomId: string) => boolean;
  setUnreadCounts: (unread: number, mentions: number) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationStoreState>(
  (set, get) => ({
    level: "all",
    dnd: false,
    soundEnabled: true,
    mutedRooms: new Set(),
    totalUnreadCount: 0,
    totalMentionCount: 0,

    setLevel: (level) => set({ level }),
    setDnd: (dnd) => set({ dnd }),
    setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

    muteRoom: (roomId) =>
      set((s) => {
        const next = new Set(s.mutedRooms);
        next.add(roomId);
        return { mutedRooms: next };
      }),

    unmuteRoom: (roomId) =>
      set((s) => {
        const next = new Set(s.mutedRooms);
        next.delete(roomId);
        return { mutedRooms: next };
      }),

    isRoomMuted: (roomId) => get().mutedRooms.has(roomId),

    setUnreadCounts: (unread, mentions) =>
      set({ totalUnreadCount: unread, totalMentionCount: mentions }),

    reset: () =>
      set({
        level: "all",
        dnd: false,
        soundEnabled: true,
        mutedRooms: new Set(),
        totalUnreadCount: 0,
        totalMentionCount: 0,
      }),
  }),
);
