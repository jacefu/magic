import { useEffect, useMemo, useState } from "react";
import {
  ClientEvent,
  EventType,
  type MatrixEvent,
} from "matrix-js-sdk";
import {
  getClient,
  hasClient,
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

/**
 * Pull the set of room ids the current user has marked as DMs in
 * `m.direct` account-data. This is the canonical Matrix DM marker —
 * `Room.getDMInviter()` only fires when *someone else* invited you
 * with `is_direct: true`, so self-created DMs need this lookup to
 * end up in the right section.
 */
function readDmRoomIds(): Set<string> {
  if (!hasClient()) return new Set();
  try {
    const ev = getClient().getAccountData(EventType.Direct);
    const map = ev?.getContent() as
      | Record<string, string[]>
      | undefined;
    if (!map) return new Set();
    const ids = new Set<string>();
    for (const list of Object.values(map)) {
      if (!Array.isArray(list)) continue;
      for (const rid of list) ids.add(rid);
    }
    return ids;
  } catch {
    return new Set();
  }
}

function useDmRoomIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => readDmRoomIds());

  useEffect(() => {
    if (!hasClient()) return;
    const client = getClient();
    // Re-read when sync completes (covers initial population on app
    // boot where account-data may not have been ready when the hook
    // first mounted) or whenever m.direct itself updates.
    const refresh = (event?: MatrixEvent) => {
      if (event && event.getType() !== EventType.Direct) return;
      setIds(readDmRoomIds());
    };
    client.on(ClientEvent.AccountData, refresh);
    refresh();
    return () => {
      client.off(ClientEvent.AccountData, refresh);
    };
  }, []);

  return ids;
}

export function useFilteredRooms() {
  const rooms = useRoomStore((s) => s.rooms);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const dmRoomIds = useDmRoomIds();

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
      // Either signal counts as DM: explicit m.direct membership
      // (covers self-created DMs) or the legacy 2-member heuristic
      // (covers DMs created by other clients that didn't bother to
      // update m.direct).
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
