import { create } from "zustand";

export type SyncState = "STOPPED" | "SYNCING" | "PREPARED" | "ERROR" | "RECONNECTING";

interface SyncStoreState {
  syncState: SyncState;
  lastSyncError: string | null;
  initialSyncComplete: boolean;
  setSyncState: (state: SyncState) => void;
  setSyncError: (error: string | null) => void;
  setInitialSyncComplete: () => void;
  reset: () => void;
}

export const useSyncStore = create<SyncStoreState>((set) => ({
  syncState: "STOPPED",
  lastSyncError: null,
  initialSyncComplete: false,
  setSyncState: (syncState) => set({ syncState }),
  setSyncError: (lastSyncError) => set({ lastSyncError }),
  setInitialSyncComplete: () => set({ initialSyncComplete: true }),
  reset: () => set({ syncState: "STOPPED", lastSyncError: null, initialSyncComplete: false }),
}));
