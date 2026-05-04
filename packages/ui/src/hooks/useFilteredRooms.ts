import { useMemo, useState } from "react";
import {
  getClient,
  hasClient,
  useDmStore,
  useRoomStore,
  type RoomData,
} from "@magic/matrix-client";
import { isDmRoom } from "../lib/isDmRoom.js";

export interface RoomGroup {
  label: string;
  key: "dm" | "group";
  rooms: RoomData[];
  collapsed: boolean;
}

function roomMatchesQuery(room: RoomData, term: string): boolean {
  if (room.name.toLowerCase().includes(term)) return true;
  if (!hasClient()) return false;
  try {
    const sdkRoom = getClient().getRoom(room.roomId);
    if (!sdkRoom) return false;
    for (const member of sdkRoom.getJoinedMembers()) {
      if (member.userId.toLowerCase().includes(term)) return true;
      if (member.name?.toLowerCase().includes(term)) return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

export function useFilteredRooms() {
  const rooms = useRoomStore((s) => s.rooms);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

  // DM room ids come from `useDmStore`, which is fed by:
  //   - bridge.ts seeding from `m.direct` on PREPARED + on every
  //     m.direct AccountData echo,
  //   - `createDM` synchronously tagging newly-created rooms before
  //     the m.direct PUT round-trips.
  // The store is the single source of truth for "this room is a DM",
  // so we don't have to chase the matrix-js-sdk account-data cache
  // ourselves here.
  const dmRoomIds = useDmStore((s) => s.dmRoomIds);

  const groups = useMemo(() => {
    const allRooms = Object.values(rooms);

    // Search matches rooms by name AND by joined-member display name
    // / userId (so typing an Agent or username finds rooms with that
    // person — useful when the room itself is a DM with an opaque
    // server-generated name, or a group with multiple participants).
    const term = searchQuery.trim().toLowerCase();
    const filtered = term
      ? allRooms.filter((r) => roomMatchesQuery(r, term))
      : allRooms;

    const dms: RoomData[] = [];
    const groupRooms: RoomData[] = [];
    for (const room of filtered) {
      // Either signal counts as DM: explicit dmStore membership
      // (covers self-created DMs and m.direct from any source) or
      // the legacy 2-member heuristic (covers DMs created by other
      // clients that didn't bother to update m.direct).
      if (dmRoomIds.has(room.roomId) || isDmRoom(room)) {
        dms.push(room);
      } else {
        groupRooms.push(room);
      }
    }

    const sortFn = (a: RoomData, b: RoomData) => {
      const aUnread = a.unreadCount > 0 ? 1 : 0;
      const bUnread = b.unreadCount > 0 ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      return b.lastActivityTs - a.lastActivityTs;
    };

    dms.sort(sortFn);
    groupRooms.sort(sortFn);

    const result: RoomGroup[] = [];

    if (dms.length > 0) {
      result.push({
        label: "私聊",
        key: "dm",
        rooms: dms,
        collapsed: collapsedSections["dm"] ?? false,
      });
    }

    if (groupRooms.length > 0) {
      result.push({
        label: "AGENT 团队",
        key: "group",
        rooms: groupRooms,
        collapsed: collapsedSections["group"] ?? false,
      });
    }

    return result;
  }, [rooms, searchQuery, collapsedSections, dmRoomIds]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const totalUnreadCount = useMemo(() => {
    return Object.values(rooms).reduce((sum, r) => sum + r.unreadCount, 0);
  }, [rooms]);

  return {
    groups,
    searchQuery,
    setSearchQuery,
    toggleSection,
    totalUnreadCount,
  };
}
