import { create } from "zustand";

interface UserActivityState {
  /** Most recent timeline-event timestamp (ms) per userId. */
  lastSeen: Record<string, number>;

  setLastSeen: (userId: string, ts: number) => void;
  getLastSeen: (userId: string) => number | null;
  reset: () => void;
}

/**
 * Per-user activity tracker. Updated whenever the SDK delivers a timeline
 * event from a given sender. Used by `agentDetection` as a "they sent
 * something recently" signal so Manager Agents (and any other bots that
 * don't emit `com.magic.agent.status`) don't appear permanently offline
 * while actively chatting.
 *
 * Resolution: we only ever overwrite with a newer timestamp. Out-of-order
 * historical events from `paginateBackwards` won't regress the value.
 */
export const useUserActivityStore = create<UserActivityState>((set, get) => ({
  lastSeen: {},

  setLastSeen: (userId, ts) =>
    set((s) => {
      const prev = s.lastSeen[userId];
      if (prev !== undefined && prev >= ts) return s;
      return { lastSeen: { ...s.lastSeen, [userId]: ts } };
    }),

  getLastSeen: (userId) => get().lastSeen[userId] ?? null,

  reset: () => set({ lastSeen: {} }),
}));
