import { create } from "zustand";
import type { SerializedMember } from "../serializers.js";

interface UserStoreState {
  users: Record<string, SerializedMember>;
  currentUserId: string | null;
  setCurrentUser: (userId: string) => void;
  upsertUser: (user: SerializedMember) => void;
  reset: () => void;
}

export const useUserStore = create<UserStoreState>((set) => ({
  users: {},
  currentUserId: null,
  setCurrentUser: (userId) => set({ currentUserId: userId }),
  upsertUser: (user) =>
    set((s) => ({ users: { ...s.users, [user.userId]: user } })),
  reset: () => set({ users: {}, currentUserId: null }),
}));
