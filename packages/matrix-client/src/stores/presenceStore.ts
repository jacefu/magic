import { create } from "zustand";

export type PresenceState = "online" | "unavailable" | "offline";

interface PresenceData {
  presence: PresenceState;
  lastActiveAgo?: number;
  currentlyActive?: boolean;
  statusMsg?: string;
  /** When this client received the presence update (Date.now() ms) */
  updatedAt: number;
}

interface PresenceStoreState {
  presences: Record<string, PresenceData>;

  setPresence: (userId: string, data: Omit<PresenceData, "updatedAt">) => void;
  getPresence: (userId: string) => PresenceData | null;
  reset: () => void;
}

export const usePresenceStore = create<PresenceStoreState>((set, get) => ({
  presences: {},

  setPresence: (userId, data) =>
    set((s) => ({
      presences: {
        ...s.presences,
        [userId]: { ...data, updatedAt: Date.now() },
      },
    })),

  getPresence: (userId) => get().presences[userId] ?? null,

  reset: () => set({ presences: {} }),
}));
