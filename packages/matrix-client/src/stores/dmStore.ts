import { create } from "zustand";

/**
 * Tracks which room ids the current user treats as 1:1 DMs. The
 * canonical source is `m.direct` account-data, but its update path
 * is asynchronous and racy:
 *   - `createDM` calls `setAccountData("m.direct", ...)` which awaits
 *     a /sync echo from the homeserver before resolving.
 *   - Meanwhile bridge.ts adds the new room to `useRoomStore` from
 *     the same /sync (or earlier).
 *   - Until the m.direct echo lands, `useFilteredRooms` would group
 *     the room as 群聊.
 *   - If the homeserver rejects the PUT (or the network drops it),
 *     we'd never recover.
 *
 * This store lets callers write the truth optimistically:
 *   - `createDM` calls `markDm(roomId)` *synchronously* after
 *     `createRoom` returns, so the new DM enters the 私聊 section
 *     immediately.
 *   - Bridge.ts seeds the store from initial m.direct on PREPARED
 *     and reconciles incremental AccountData echoes after that, so
 *     DMs created from another client (or before this app started)
 *     also show up correctly.
 */
interface DmStoreState {
  /** Set of room ids known to be DMs. */
  dmRoomIds: ReadonlySet<string>;
  markDm: (roomId: string) => void;
  setDmRoomIds: (ids: Iterable<string>) => void;
  reset: () => void;
}

export const useDmStore = create<DmStoreState>((set) => ({
  dmRoomIds: new Set<string>(),

  markDm: (roomId) =>
    set((s) => {
      if (s.dmRoomIds.has(roomId)) return s;
      const next = new Set(s.dmRoomIds);
      next.add(roomId);
      return { dmRoomIds: next };
    }),

  setDmRoomIds: (ids) => set({ dmRoomIds: new Set(ids) }),

  reset: () => set({ dmRoomIds: new Set() }),
}));
