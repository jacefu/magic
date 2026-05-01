import type { RoomData } from "@magic/matrix-client";

/**
 * A room is a DM iff it has exactly two joined members.
 *
 * The `m.direct` flag is unreliable on Matrix (set by whichever client
 * created the room, often missing on rooms created via API or by Agents).
 * Member count is what users perceive as "DM" — a 1:1 conversation.
 */
export function isDmRoom(room: Pick<RoomData, "memberCount">): boolean {
  return room.memberCount === 2;
}
