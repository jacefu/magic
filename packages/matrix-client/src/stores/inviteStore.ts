import { create } from "zustand";

/**
 * A pending or in-flight room invite. Spec 018 — populated when the
 * MatrixClient sees `RoomEvent.MyMembership` transition to `invite`,
 * cleared once the user accepts or declines (or another client does).
 *
 * Each invite carries its `sessionId` so the UI can filter to the
 * active workspace; the store itself keys by `roomId` only because
 * Matrix room ids are globally unique (they include the homeserver).
 */
export interface RoomInvite {
  roomId: string;
  roomName: string | null;
  roomAvatarMxc: string | null;
  inviterId: string;
  inviterName: string;
  isDirect: boolean;
  isEncrypted: boolean;
  timestamp: number;
  status: "pending" | "accepting" | "declining";
  sessionId: string;
}

interface InviteStoreState {
  invites: Record<string, RoomInvite>;

  addInvite: (invite: RoomInvite) => void;
  removeInvite: (roomId: string) => void;
  updateInviteStatus: (roomId: string, status: RoomInvite["status"]) => void;
  removeInvitesForSession: (sessionId: string) => void;
  getInvitesForSession: (sessionId: string) => RoomInvite[];
  getInviteCount: (sessionId?: string) => number;
  reset: () => void;
}

export const useInviteStore = create<InviteStoreState>((set, get) => ({
  invites: {},

  addInvite: (invite) =>
    set((s) => ({
      invites: { ...s.invites, [invite.roomId]: invite },
    })),

  removeInvite: (roomId) =>
    set((s) => {
      if (!s.invites[roomId]) return s;
      const { [roomId]: _, ...rest } = s.invites;
      return { invites: rest };
    }),

  updateInviteStatus: (roomId, status) =>
    set((s) => {
      const existing = s.invites[roomId];
      if (!existing) return s;
      return {
        invites: { ...s.invites, [roomId]: { ...existing, status } },
      };
    }),

  removeInvitesForSession: (sessionId) =>
    set((s) => {
      const next: Record<string, RoomInvite> = {};
      for (const [id, invite] of Object.entries(s.invites)) {
        if (invite.sessionId !== sessionId) next[id] = invite;
      }
      return { invites: next };
    }),

  getInvitesForSession: (sessionId) =>
    Object.values(get().invites)
      .filter((inv) => inv.sessionId === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp),

  getInviteCount: (sessionId) => {
    const invites = Object.values(get().invites);
    if (sessionId) {
      return invites.filter((i) => i.sessionId === sessionId).length;
    }
    return invites.length;
  },

  reset: () => set({ invites: {} }),
}));
