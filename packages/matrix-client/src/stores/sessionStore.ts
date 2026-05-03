import { create } from "zustand";
import type { SyncState } from "./syncStore.js";

export interface ServerSession {
  /** Stable id derived from the homeserver URL (see `createSessionId`). */
  id: string;
  homeserver: string;
  userId: string;
  deviceId: string;
  accessToken: string;
  displayName: string | null;
  avatarMxc: string | null;
  /** Display name used in the workspace rail (e.g. "matrix-local"). */
  serverName: string;
  /** Single-letter avatar text in the workspace rail. */
  serverInitial: string;
  /** Hex colour for the workspace icon. */
  serverColor: string | null;
  syncState: SyncState;
  /**
   * Latches `true` the first time the session reaches PREPARED. Used by
   * the workspace icon to decide whether to show the spinner: SYNCING
   * during the initial sync = spinner; SYNCING during steady-state
   * long-poll afterwards = no spinner (just the static initial).
   */
  initialSyncComplete: boolean;
  unreadCount: number;
  highlightCount: number;
  /** Timestamp (ms) the session was first added — drives stable ordering. */
  addedAt: number;
}

interface SessionStoreState {
  /** All currently-logged-in homeserver sessions, keyed by id. */
  sessions: Record<string, ServerSession>;
  /** Id of the session whose data the UI should currently render. */
  activeSessionId: string | null;
  /** True while AddServerDialog (or WelcomePage's add flow) is in flight. */
  isAddingServer: boolean;

  addSession: (session: ServerSession) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<ServerSession>) => void;
  setActiveSession: (id: string | null) => void;
  setIsAddingServer: (v: boolean) => void;

  getActiveSession: () => ServerSession | null;
  getSessionList: () => ServerSession[];
  reset: () => void;
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessions: {},
  activeSessionId: null,
  isAddingServer: false,

  addSession: (session) =>
    set((s) => ({
      sessions: { ...s.sessions, [session.id]: session },
      // The first added session becomes active automatically.
      activeSessionId: s.activeSessionId ?? session.id,
    })),

  removeSession: (id) =>
    set((s) => {
      if (!(id in s.sessions)) return s;
      const next = { ...s.sessions };
      delete next[id];
      const newActive =
        s.activeSessionId === id
          ? (Object.keys(next)[0] ?? null)
          : s.activeSessionId;
      return { sessions: next, activeSessionId: newActive };
    }),

  updateSession: (id, updates) =>
    set((s) => {
      const existing = s.sessions[id];
      if (!existing) return s;
      return {
        sessions: { ...s.sessions, [id]: { ...existing, ...updates } },
      };
    }),

  setActiveSession: (id) => set({ activeSessionId: id }),
  setIsAddingServer: (v) => set({ isAddingServer: v }),

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return activeSessionId ? (sessions[activeSessionId] ?? null) : null;
  },

  getSessionList: () =>
    Object.values(get().sessions).sort((a, b) => a.addedAt - b.addedAt),

  reset: () =>
    set({ sessions: {}, activeSessionId: null, isAddingServer: false }),
}));
