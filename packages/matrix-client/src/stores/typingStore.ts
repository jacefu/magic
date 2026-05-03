import { create } from "zustand";

interface TypingStoreState {
  /** sessionId → roomId → userIds[] */
  sessionTyping: Record<string, Record<string, string[]>>;
  /** Mirror of sessionTyping[activeSessionId] for active-session reads. */
  typing: Record<string, string[]>;
  activeSessionId: string | null;

  setActiveSession: (sessionId: string | null) => void;
  removeSession: (sessionId: string) => void;
  setTyping: (
    sessionId: string,
    roomId: string,
    userId: string,
    isTyping: boolean,
  ) => void;
  clearRoom: (sessionId: string, roomId: string) => void;
  getTyping: (sessionId: string, roomId: string) => string[];
  reset: () => void;
}

function relinkActive(
  s: TypingStoreState,
): Pick<TypingStoreState, "typing"> {
  const id = s.activeSessionId;
  return {
    typing: id ? (s.sessionTyping[id] ?? {}) : {},
  };
}

export const useTypingStore = create<TypingStoreState>((set, get) => ({
  sessionTyping: {},
  typing: {},
  activeSessionId: null,

  setActiveSession: (sessionId) =>
    set((s) => ({
      activeSessionId: sessionId,
      typing: sessionId ? (s.sessionTyping[sessionId] ?? {}) : {},
    })),

  removeSession: (sessionId) =>
    set((s) => {
      const next = { ...s.sessionTyping };
      delete next[sessionId];
      const newActive =
        s.activeSessionId === sessionId
          ? (Object.keys(next)[0] ?? null)
          : s.activeSessionId;
      return {
        sessionTyping: next,
        activeSessionId: newActive,
        typing: newActive ? (next[newActive] ?? {}) : {},
      };
    }),

  setTyping: (sessionId, roomId, userId, isTyping) =>
    set((s) => {
      const sessionMap = s.sessionTyping[sessionId] ?? {};
      const current = new Set(sessionMap[roomId] ?? []);
      if (isTyping) current.add(userId);
      else current.delete(userId);
      const updatedRoom = { ...sessionMap, [roomId]: Array.from(current) };
      const next = { ...s.sessionTyping, [sessionId]: updatedRoom };
      return {
        sessionTyping: next,
        ...relinkActive({ ...s, sessionTyping: next }),
      };
    }),

  clearRoom: (sessionId, roomId) =>
    set((s) => {
      const sessionMap = s.sessionTyping[sessionId];
      if (!sessionMap) return s;
      const { [roomId]: _, ...rest } = sessionMap;
      const next = { ...s.sessionTyping, [sessionId]: rest };
      return {
        sessionTyping: next,
        ...relinkActive({ ...s, sessionTyping: next }),
      };
    }),

  getTyping: (sessionId, roomId) =>
    get().sessionTyping[sessionId]?.[roomId] ?? [],

  reset: () =>
    set({
      sessionTyping: {},
      typing: {},
      activeSessionId: null,
    }),
}));
