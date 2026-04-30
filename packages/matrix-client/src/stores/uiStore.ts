import { create } from "zustand";

interface UIStoreState {
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelMode: "members" | "files" | "agents" | "settings" | null;
  composerReplyTo: string | null;
  toggleSidebar: () => void;
  setRightPanel: (mode: UIStoreState["rightPanelMode"]) => void;
  closeRightPanel: () => void;
  setComposerReplyTo: (eventId: string | null) => void;
  reset: () => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  sidebarOpen: true,
  rightPanelOpen: false,
  rightPanelMode: null,
  composerReplyTo: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setRightPanel: (mode) => set({ rightPanelOpen: true, rightPanelMode: mode }),
  closeRightPanel: () => set({ rightPanelOpen: false, rightPanelMode: null }),
  setComposerReplyTo: (eventId) => set({ composerReplyTo: eventId }),
  reset: () =>
    set({
      sidebarOpen: true,
      rightPanelOpen: false,
      rightPanelMode: null,
      composerReplyTo: null,
    }),
}));
