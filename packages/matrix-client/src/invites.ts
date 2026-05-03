import { getSessionClient } from "./session-manager.js";
import { useInviteStore } from "./stores/inviteStore.js";

/**
 * Resolve the MatrixClient that owns a given pending invite. Spec 018
 * + 017 — the inviteStore tags each invite with the sessionId it
 * arrived on, so we look up the invite's session and ask the
 * session-manager for the matching client.
 */
function clientForInvite(roomId: string) {
  const invite = useInviteStore.getState().invites[roomId];
  if (!invite) {
    throw new Error(`No pending invite for room ${roomId}`);
  }
  const client = getSessionClient(invite.sessionId);
  if (!client) {
    throw new Error(
      `Session ${invite.sessionId} for invite ${roomId} is not active`,
    );
  }
  return { invite, client };
}

/**
 * Accept a room invite. Joins the room and clears the invite from the
 * store; the joined room flows back through the regular bridge once
 * the next /sync arrives.
 */
export async function acceptInvite(roomId: string): Promise<void> {
  const inviteStore = useInviteStore.getState();
  inviteStore.updateInviteStatus(roomId, "accepting");

  try {
    const { client } = clientForInvite(roomId);
    await client.joinRoom(roomId);
    inviteStore.removeInvite(roomId);
  } catch (err) {
    inviteStore.updateInviteStatus(roomId, "pending");
    throw err;
  }
}

/** Decline a room invite by leaving the invite-state room. */
export async function declineInvite(roomId: string): Promise<void> {
  const inviteStore = useInviteStore.getState();
  inviteStore.updateInviteStatus(roomId, "declining");

  try {
    const { client } = clientForInvite(roomId);
    await client.leave(roomId);
    inviteStore.removeInvite(roomId);
  } catch (err) {
    inviteStore.updateInviteStatus(roomId, "pending");
    throw err;
  }
}

/**
 * Decline and add the inviter to this session's ignore list so future
 * invites from them are filtered out by the homeserver.
 */
export async function declineAndBlockInvite(roomId: string): Promise<void> {
  const inviteStore = useInviteStore.getState();
  const existing = inviteStore.invites[roomId];
  inviteStore.updateInviteStatus(roomId, "declining");

  try {
    const { invite, client } = clientForInvite(roomId);
    await client.leave(roomId);

    if (invite.inviterId) {
      try {
        const ignored = client.getIgnoredUsers();
        if (!ignored.includes(invite.inviterId)) {
          await client.setIgnoredUsers([...ignored, invite.inviterId]);
        }
      } catch (err) {
        console.warn("更新忽略列表失败:", (err as Error).message);
      }
    }

    inviteStore.removeInvite(roomId);
  } catch (err) {
    if (existing) inviteStore.updateInviteStatus(roomId, "pending");
    throw err;
  }
}

/**
 * Best-effort: accept every pending invite from a given inviter.
 * Failures are logged per-invite and don't abort the loop — used by
 * the auto-accept hook for Manager-issued workspaces.
 */
export async function acceptAllInvitesFrom(inviterId: string): Promise<void> {
  const invites = Object.values(useInviteStore.getState().invites).filter(
    (inv) => inv.inviterId === inviterId && inv.status === "pending",
  );

  for (const invite of invites) {
    try {
      await acceptInvite(invite.roomId);
    } catch (err) {
      console.error(
        `接受邀请 ${invite.roomId} 失败:`,
        (err as Error).message,
      );
    }
  }
}
