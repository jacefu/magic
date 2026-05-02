import { create } from "zustand";

interface ComposerInsertRequest {
  text: string;
  /** Bumped on every request so identical insertions still re-fire the
   *  composer's effect (e.g. clicking the same user twice in a row). */
  version: number;
}

interface UIStoreState {
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelMode: "members" | "files" | "agents" | "settings" | null;
  composerReplyTo: string | null;
  /**
   * Pending text to splice into the active room's composer at the
   * cursor. Set by anyone (sender-name click, emoji picker, …),
   * consumed and cleared by `useComposer` once applied.
   */
  composerInsertRequest: ComposerInsertRequest | null;
  toggleSidebar: () => void;
  setRightPanel: (mode: UIStoreState["rightPanelMode"]) => void;
  closeRightPanel: () => void;
  setComposerReplyTo: (eventId: string | null) => void;
  requestComposerInsert: (text: string) => void;
  consumeComposerInsert: () => void;
  reset: () => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  sidebarOpen: true,
  rightPanelOpen: false,
  rightPanelMode: null,
  composerReplyTo: null,
  composerInsertRequest: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setRightPanel: (mode) => set({ rightPanelOpen: true, rightPanelMode: mode }),
  closeRightPanel: () => set({ rightPanelOpen: false, rightPanelMode: null }),
  setComposerReplyTo: (eventId) => set({ composerReplyTo: eventId }),
  requestComposerInsert: (text) =>
    set((s) => ({
      composerInsertRequest: {
        text,
        version: (s.composerInsertRequest?.version ?? 0) + 1,
      },
    })),
  consumeComposerInsert: () => set({ composerInsertRequest: null }),
  reset: () =>
    set({
      sidebarOpen: true,
      rightPanelOpen: false,
      rightPanelMode: null,
      composerReplyTo: null,
      composerInsertRequest: null,
    }),
}));
