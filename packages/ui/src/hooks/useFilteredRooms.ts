import { useMemo, useState } from "react";
import { useRoomStore, type RoomData } from "@magic/matrix-client";

export interface RoomGroup {
  label: string;
  key: "dm" | "group";
  rooms: RoomData[];
  collapsed: boolean;
}

export function useFilteredRooms() {
  const rooms = useRoomStore((s) => s.rooms);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const allRooms = Object.values(rooms);

    const filtered = searchQuery.trim()
      ? allRooms.filter((r) =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : allRooms;

    const dms: RoomData[] = [];
    const groupRooms: RoomData[] = [];
    for (const room of filtered) {
      if (room.isDirect) {
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
  }, [rooms, searchQuery, collapsedSections]);

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
