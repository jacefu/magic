import { useCallback, useMemo, useState } from "react";
import {
  getClient,
  hasClient,
  useAuthStore,
  useDmStore,
  useRoomStore,
} from "@magic/matrix-client";

export type NotificationMode = "all" | "mentions" | "mute";

export interface RoomSettings {
  roomId: string;
  name: string;
  topic: string;
  avatarMxc: string | null;
  isEncrypted: boolean;
  isDirect: boolean;
  /** Power level of the current user in this room. */
  myPowerLevel: number;
  /** Can the current user edit `m.room.name` / `m.room.topic`? */
  canEditInfo: boolean;
  /** Can the current user invite new members? */
  canInvite: boolean;
  /** Can the current user kick members? */
  canKick: boolean;
  /** Can the current user change others' power levels? Requires PL ≥ 100. */
  canSetPower: boolean;
  roomVersion: string;
  memberCount: number;
}

/**
 * Spec 021 — read/write hook for the room settings panel.
 *
 * Subscribes to roomStore + authStore so the returned settings
 * recompute on relevant state changes. Permissions are derived from
 * the room's `m.room.power_levels` state event with sensible Matrix
 * defaults when fields are missing (state_default = 50, invite = 50,
 * kick = 50).
 */
export function useRoomSettings(roomId: string) {
  const userId = useAuthStore((s) => s.userId);
  const room = useRoomStore((s) => s.rooms?.[roomId]);
  const dmRoomIds = useDmStore((s) => s.dmRoomIds);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settings = useMemo<RoomSettings | null>(() => {
    if (!hasClient() || !userId) return null;
    const client = getClient();
    const matrixRoom = client.getRoom(roomId);
    if (!matrixRoom || !room) return null;

    const myPower = matrixRoom.getMember(userId)?.powerLevel ?? 0;
    const plEvent = matrixRoom.currentState.getStateEvents(
      "m.room.power_levels",
      "",
    );
    const plContent = (plEvent?.getContent() ?? {}) as {
      events?: Record<string, number>;
      state_default?: number;
      events_default?: number;
      invite?: number;
      kick?: number;
    };
    const editPower =
      plContent.events?.["m.room.name"] ??
      plContent.events?.["m.room.topic"] ??
      plContent.state_default ??
      50;
    const invitePower = plContent.invite ?? 0;
    const kickPower = plContent.kick ?? 50;

    const encryptionEvent = matrixRoom.currentState.getStateEvents(
      "m.room.encryption",
      "",
    );

    const avatarEvent = matrixRoom.currentState.getStateEvents(
      "m.room.avatar",
      "",
    );
    const avatarMxc =
      (avatarEvent?.getContent() as { url?: string } | undefined)?.url ??
      null;

    return {
      roomId,
      name: room.name,
      topic: room.topic,
      avatarMxc,
      isEncrypted: !!encryptionEvent,
      isDirect: dmRoomIds.has(roomId) || room.memberCount === 2,
      myPowerLevel: myPower,
      canEditInfo: myPower >= editPower,
      canInvite: myPower >= invitePower,
      canKick: myPower >= kickPower,
      canSetPower: myPower >= 100,
      roomVersion: matrixRoom.getVersion() ?? "?",
      memberCount: matrixRoom.getJoinedMemberCount(),
    };
  }, [roomId, userId, room, dmRoomIds]);

  const setRoomName = useCallback(
    async (name: string) => {
      setIsSaving(true);
      setError(null);
      try {
        await getClient().sendStateEvent(
          roomId,
          "m.room.name" as never,
          { name } as never,
          "",
        );
      } catch (err) {
        setError((err as Error).message ?? "修改房间名失败");
      } finally {
        setIsSaving(false);
      }
    },
    [roomId],
  );

  const setRoomTopic = useCallback(
    async (topic: string) => {
      setIsSaving(true);
      setError(null);
      try {
        await getClient().sendStateEvent(
          roomId,
          "m.room.topic" as never,
          { topic } as never,
          "",
        );
      } catch (err) {
        setError((err as Error).message ?? "修改话题失败");
      } finally {
        setIsSaving(false);
      }
    },
    [roomId],
  );

  const inviteMember = useCallback(
    async (targetUserId: string) => {
      try {
        await getClient().invite(roomId, targetUserId);
      } catch (err) {
        throw new Error((err as Error).message ?? "邀请失败");
      }
    },
    [roomId],
  );

  const kickMember = useCallback(
    async (targetUserId: string, reason?: string) => {
      try {
        await getClient().kick(roomId, targetUserId, reason);
      } catch (err) {
        throw new Error((err as Error).message ?? "移除失败");
      }
    },
    [roomId],
  );

  const leaveRoom = useCallback(async () => {
    try {
      await getClient().leave(roomId);
    } catch (err) {
      throw new Error((err as Error).message ?? "离开失败");
    }
  }, [roomId]);

  // Notification mode is stored in two places:
  //   1. Push rules — for `mute` we use setRoomMutePushRule which
  //      flips a server-side rule that suppresses delivery.
  //   2. Room account-data — for our own UI state we persist the
  //      explicit choice ("mentions" doesn't have a perfect Matrix
  //      analogue, so we treat it as "not mute" + a UI hint).
  const setNotificationMode = useCallback(
    async (mode: NotificationMode) => {
      try {
        const client = getClient();
        const muted = mode === "mute";
        const result = client.setRoomMutePushRule("global", roomId, muted);
        if (result) await result;
        await client.setRoomAccountData(
          roomId,
          "com.magic.notification_mode" as never,
          { mode } as never,
        );
      } catch (err) {
        console.error("设置通知失败:", (err as Error).message);
      }
    },
    [roomId],
  );

  const toggleFavourite = useCallback(async () => {
    try {
      const client = getClient();
      const matrixRoom = client.getRoom(roomId);
      const tags = matrixRoom?.tags ?? {};
      if (tags["m.favourite"]) {
        await client.deleteRoomTag(roomId, "m.favourite");
      } else {
        await client.setRoomTag(roomId, "m.favourite", { order: 0.5 });
      }
    } catch (err) {
      console.error("切换置顶失败:", (err as Error).message);
    }
  }, [roomId]);

  /** Read the persisted notification mode + favourite flag. Read on
   *  demand rather than memoised because it bypasses zustand and we
   *  want callers to refresh after toggles. */
  const readPersistedPrefs = useCallback((): {
    mode: NotificationMode;
    isFavourite: boolean;
  } => {
    if (!hasClient()) return { mode: "all", isFavourite: false };
    const client = getClient();
    const matrixRoom = client.getRoom(roomId);
    if (!matrixRoom) return { mode: "all", isFavourite: false };
    const isFavourite = !!matrixRoom.tags?.["m.favourite"];
    const ev = matrixRoom.getAccountData(
      "com.magic.notification_mode" as never,
    );
    const persisted = ev?.getContent() as { mode?: string } | undefined;
    const m = persisted?.mode;
    const mode: NotificationMode =
      m === "mentions" || m === "mute" || m === "all" ? m : "all";
    return { mode, isFavourite };
  }, [roomId]);

  return {
    settings,
    isSaving,
    error,
    setRoomName,
    setRoomTopic,
    inviteMember,
    kickMember,
    leaveRoom,
    setNotificationMode,
    toggleFavourite,
    readPersistedPrefs,
  };
}
