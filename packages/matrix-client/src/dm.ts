import { EventType, Preset, type MatrixClient } from "matrix-js-sdk";
import { getClient } from "./client.js";

/**
 * Spec 020 FIX-3 — start (or reuse) a 1:1 DM with the given userId.
 *
 * Matrix's convention is to track DM relationships in `m.direct`
 * account-data: a map from peer userId → list of joined DM room ids.
 * If we already have a live joined DM with this peer, hand back its
 * room id rather than creating a duplicate (Element does the same).
 *
 * For a fresh DM we use `Preset.TrustedPrivateChat` so both parties
 * land at PL 100 and either can invite/leave without operator
 * intervention. Encryption is on by default — every modern DM in
 * Matrix should be e2ee.
 */
export async function createDM(userId: string): Promise<string> {
  const client = getClient();

  const existing = findExistingDM(client, userId);
  if (existing) return existing;

  const { room_id } = await client.createRoom({
    preset: Preset.TrustedPrivateChat,
    invite: [userId],
    is_direct: true,
    initial_state: [
      {
        type: "m.room.encryption",
        state_key: "",
        content: { algorithm: "m.megolm.v1.aes-sha2" },
      },
    ],
  });

  // Update m.direct so the peer's other clients (and our own room
  // list grouping logic) recognise this room as a DM. Failure here
  // is non-fatal — the room still works, it just won't be tagged.
  try {
    const directEvent = client.getAccountData(EventType.Direct);
    const existingMap =
      (directEvent?.getContent() as Record<string, string[]> | undefined) ??
      {};
    const existingRooms = existingMap[userId] ?? [];
    await client.setAccountData(EventType.Direct, {
      ...existingMap,
      [userId]: [...existingRooms, room_id],
    });
  } catch (err) {
    console.warn("更新 m.direct 失败:", (err as Error).message);
  }

  return room_id;
}

function findExistingDM(
  client: MatrixClient,
  userId: string,
): string | null {
  const directEvent = client.getAccountData(EventType.Direct);
  const map = directEvent?.getContent() as
    | Record<string, string[]>
    | undefined;
  if (!map) return null;
  const roomIds = map[userId];
  if (!roomIds || roomIds.length === 0) return null;

  for (const roomId of roomIds) {
    const room = client.getRoom(roomId);
    if (room && room.getMyMembership() === "join") {
      return roomId;
    }
  }
  return null;
}
