import { EventType, Preset, type MatrixClient } from "matrix-js-sdk";
import { getClient } from "./client.js";
import { useDmStore } from "./stores/dmStore.js";

interface CreateDMOptions {
  /**
   * Default `false` — DM encryption is opt-in because some Tuwunel /
   * Synapse setups have flaky e2ee bootstraps for fresh rooms and
   * users have explicitly asked for it not to be on by default.
   * `StartDMDialog` exposes a toggle.
   */
  encrypted?: boolean;
}

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
 * intervention. We tag the room as a DM in the local `useDmStore`
 * synchronously, so `useFilteredRooms` puts it in 私聊 immediately
 * — without waiting for the m.direct PUT to round-trip through
 * /sync. The PUT is still issued (best-effort) so other clients
 * see this DM, but we don't depend on it for our own UI.
 */
export async function createDM(
  userId: string,
  options: CreateDMOptions = {},
): Promise<string> {
  const { encrypted = false } = options;
  const client = getClient();

  const existing = findExistingDM(client, userId);
  if (existing) {
    // Tag in case the local store hasn't seen this room yet (e.g.
    // restored from another session) — idempotent.
    useDmStore.getState().markDm(existing);
    return existing;
  }

  const { room_id } = await client.createRoom({
    preset: Preset.TrustedPrivateChat,
    invite: [userId],
    is_direct: true,
    initial_state: encrypted
      ? [
          {
            type: "m.room.encryption",
            state_key: "",
            content: { algorithm: "m.megolm.v1.aes-sha2" },
          },
        ]
      : [],
  });

  // Optimistically tag this room as a DM *before* awaiting the
  // m.direct PUT, so the room list groups it under 私聊 the moment
  // /sync delivers the room itself — independent of the account-data
  // echo timing or whether the PUT even succeeds.
  useDmStore.getState().markDm(room_id);

  // Best-effort m.direct update so the peer's other clients (and
  // any future fresh boot of this app) recognise the room as a DM.
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
    // Local DM tagging stays correct even on failure — the user can
    // still see this room as a DM. We just lose multi-client sync
    // of the m.direct map for this entry.
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
