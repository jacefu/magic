import { create } from "zustand";

export type AuthStage =
  | "initializing"
  | "unauthenticated"
  | "logging_in"
  | "restoring"
  | "syncing"
  | "authenticated"
  | "error";

export interface AuthUser {
  userId: string;
  homeserver: string;
  displayName?: string;
  avatarMxc?: string;
}

interface AuthStoreState {
  stage: AuthStage;
  userId: string | null;
  homeserver: string | null;
  displayName: string | null;
  avatarMxc: string | null;
  error: string | null;

  setStage: (stage: AuthStage) => void;
  setUser: (user: AuthUser) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  stage: "initializing",
  userId: null,
  homeserver: null,
  displayName: null,
  avatarMxc: null,
  error: null,

  setStage: (stage) =>
    set(stage === "error" ? { stage } : { stage, error: null }),

  setUser: (user) =>
    set({
      userId: user.userId,
      homeserver: user.homeserver,
      displayName: user.displayName ?? null,
      avatarMxc: user.avatarMxc ?? null,
    }),

  setError: (error) =>
    set(error !== null ? { error, stage: "error" as AuthStage } : { error }),

  reset: () =>
    set({
      stage: "unauthenticated",
      userId: null,
      homeserver: null,
      displayName: null,
      avatarMxc: null,
      error: null,
    }),
}));
