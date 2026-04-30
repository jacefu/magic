import { create } from "zustand";

interface TypingStoreState {
  typing: Record<string, string[]>;
  setTyping: (roomId: string, userId: string, isTyping: boolean) => void;
  clearRoom: (roomId: string) => void;
  reset: () => void;
}

export const useTypingStore = create<TypingStoreState>((set) => ({
  typing: {},

  setTyping: (roomId, userId, isTyping) =>
    set((s) => {
      const current = new Set(s.typing[roomId] ?? []);
      if (isTyping) {
        current.add(userId);
      } else {
        current.delete(userId);
      }
      return { typing: { ...s.typing, [roomId]: Array.from(current) } };
    }),

  clearRoom: (roomId) =>
    set((s) => {
      const { [roomId]: _removed, ...rest } = s.typing;
      return { typing: rest };
    }),

  reset: () => set({ typing: {} }),
}));
