import {
  ClientEvent,
  EventType,
  NotificationCountType,
  RoomEvent,
  RoomMemberEvent,
  RoomStateEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  type RoomMember,
} from "matrix-js-sdk";
import {
  MAGIC_EVENTS,
  AgentStatusEvent,
  TaskAssignmentEvent,
  type SerializedMatrixEvent,
} from "@magic/shared-types";
import { useSyncStore, type SyncState } from "./stores/syncStore.js";
import { useRoomStore } from "./stores/roomStore.js";
import { useTypingStore } from "./stores/typingStore.js";
import { useAgentStore } from "./stores/agentStore.js";
import { useInviteStore, type RoomInvite } from "./stores/inviteStore.js";
import { useDmStore } from "./stores/dmStore.js";
import { serializeEvent } from "./serializers.js";
import { fetchAgentRegistry } from "./agent-registry.js";

/**
 * Callback fired for every appended timeline event after it lands in the
 * room store. The UI layer registers this via `registerNotificationCallback`
 * so the matrix-client package doesn't need to import from `@magic/ui`
 * (which would create a circular dependency).
 */
let notificationCallback:
  | ((event: SerializedMatrixEvent) => void)
  | null = null;

export function registerNotificationCallback(
  cb: ((event: SerializedMatrixEvent) => void) | null,
): void {
  notificationCallback = cb;
}

/**
 * Spec 018: callback fired when a room invite lands so the UI can
 * surface a desktop notification or auto-accept (e.g. Manager
 * invites in HiClaw). Registered from `@magic/ui` to avoid a
 * circular dependency.
 */
let inviteNotificationCallback: ((invite: RoomInvite) => void) | null = null;

export function registerInviteNotificationCallback(
  cb: ((invite: RoomInvite) => void) | null,
): void {
  inviteNotificationCallback = cb;
}

/**
 * Bridge a MatrixClient's events into the Zustand stores.
 *
 * Spec 017: every callback writes to the per-session partition keyed
 * by `sessionId`. Multiple concurrent bridges (one per logged-in
 * homeserver) don't contaminate each other because their writes go
 * into disjoint slices of `useRoomStore.sessionRooms` /
 * `useTypingStore.sessionTyping`.
 *
 * Returns a cleanup function — call it before discarding the client.
 */
export function bridgeToStores(
  client: MatrixClient,
  sessionId: string,
): () => void {
  // Make sure the per-session partitions exist before any writes land.
  useRoomStore.getState().initSession(sessionId);

  const onSync = (
    state: string,
    _prevState: string | null,
    data?: { error?: Error },
  ) => {
    const syncStore = useSyncStore.getState();
    syncStore.setSyncState(mapSyncState(state));
    if (state === "PREPARED") {
      syncStore.setInitialSyncComplete();
      syncRoomList(client, sessionId);
      syncInviteList(client, sessionId);
      seedDmRoomIds(client);

      // Best-effort: pull the Worker / Manager registry from the HiClaw
      // Controller. Failure is silent — agentDetection falls back to
      // event-driven and pattern-based identification.
      const controllerUrl = inferControllerUrl(client);
      if (controllerUrl) void fetchAgentRegistry(controllerUrl);
    }
    if (state === "ERROR" && data?.error) {
      syncStore.setSyncError(data.error.message);
    }
  };
  client.on(ClientEvent.Sync, onSync);

  const onTimeline = (
    event: MatrixEvent,
    room: Room | undefined,
    toStartOfTimeline: boolean | undefined,
  ) => {
    if (!room || toStartOfTimeline) return;
    const serialized = serializeEvent(event);
    useRoomStore.getState().addMessage(sessionId, room.roomId, serialized);
    notificationCallback?.(serialized);
  };
  client.on(RoomEvent.Timeline, onTimeline);

  const onRoomName = (room: Room) => {
    useRoomStore
      .getState()
      .upsertRoom(sessionId, room.roomId, { name: room.name });
  };
  client.on(RoomEvent.Name, onRoomName);

  const onUnreadCount = (room: Room) => {
    useRoomStore
      .getState()
      .setUnreadCount(
        sessionId,
        room.roomId,
        room.getUnreadNotificationCount(NotificationCountType.Total) ?? 0,
        room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0,
      );
  };
  // RoomEvent.UnreadNotifications handler — cast needed as MatrixClient typed events differ
  (client as MatrixClient & { on(e: string, h: (r: Room) => void): void }).on(
    RoomEvent.UnreadNotifications,
    onUnreadCount,
  );

  const onTyping = (_event: MatrixEvent, member: RoomMember) => {
    useTypingStore
      .getState()
      .setTyping(sessionId, member.roomId, member.userId, member.typing);
  };
  client.on(RoomMemberEvent.Typing, onTyping);

  const onMembership = (
    room: Room,
    membership: string,
    prevMembership: string | undefined,
  ) => {
    if (membership === "invite") {
      const invite = parseInvite(room, sessionId);
      if (invite) {
        useInviteStore.getState().addInvite(invite);
        inviteNotificationCallback?.(invite);
      }
      return;
    }
    if (prevMembership === "invite" && membership === "join") {
      // Accepted via this client or another — drop the pending invite
      // either way; the joined room arrives through the normal sync.
      useInviteStore.getState().removeInvite(room.roomId);
      return;
    }
    if (membership === "leave") {
      useRoomStore.getState().removeRoom(sessionId, room.roomId);
      useInviteStore.getState().removeInvite(room.roomId);
    }
  };
  client.on(RoomEvent.MyMembership, onMembership);

  const onTimelineMagic = (event: MatrixEvent, room: Room | undefined) => {
    handleMagicEvent(event, room);
  };
  const onStateEventMagic = (event: MatrixEvent) => {
    const room = client.getRoom(event.getRoomId() ?? "");
    handleMagicEvent(event, room ?? undefined);
  };
  client.on(RoomEvent.Timeline, onTimelineMagic);
  client.on(RoomStateEvent.Events, onStateEventMagic);

  // m.direct echoes from /sync — keep useDmStore in sync with what
  // the homeserver knows. createDM tags the new DM optimistically;
  // this listener catches DMs created from another client and DMs
  // that the homeserver echoes after our own setAccountData.
  const onAccountData = (event: MatrixEvent) => {
    if (event.getType() !== EventType.Direct) return;
    seedDmRoomIds(client);
  };
  client.on(ClientEvent.AccountData, onAccountData);

  return () => {
    client.off(ClientEvent.Sync, onSync);
    client.off(RoomEvent.Timeline, onTimeline);
    client.off(RoomEvent.Name, onRoomName);
    (client as MatrixClient & { off(e: string, h: (r: Room) => void): void }).off(
      RoomEvent.UnreadNotifications,
      onUnreadCount,
    );
    client.off(RoomMemberEvent.Typing, onTyping);
    client.off(RoomEvent.MyMembership, onMembership);
    client.off(RoomEvent.Timeline, onTimelineMagic);
    client.off(RoomStateEvent.Events, onStateEventMagic);
    client.off(ClientEvent.AccountData, onAccountData);
  };
}

/**
 * Read every room id flagged in `m.direct` account-data and merge
 * it into `useDmStore`. Called on PREPARED (initial population) and
 * whenever `m.direct` changes via /sync.
 *
 * We merge rather than replace so optimistic ids set by `createDM`
 * before the homeserver echo arrives don't disappear.
 */
function seedDmRoomIds(client: MatrixClient): void {
  try {
    const ev = client.getAccountData(EventType.Direct);
    const map = ev?.getContent() as
      | Record<string, string[]>
      | undefined;
    if (!map) return;
    const ids = new Set<string>(useDmStore.getState().dmRoomIds);
    for (const list of Object.values(map)) {
      if (!Array.isArray(list)) continue;
      for (const rid of list) ids.add(rid);
    }
    useDmStore.getState().setDmRoomIds(ids);
  } catch (err) {
    console.warn("seedDmRoomIds failed:", (err as Error).message);
  }
}

/**
 * Best-effort guess at the HiClaw Controller URL: same hostname as the
 * Matrix homeserver, port 8080. Override with `window.__MAGIC_CONTROLLER_URL__`.
 * Returns null when no homeserver URL is available (shouldn't happen post-login).
 */
function inferControllerUrl(client: MatrixClient): string | null {
  if (typeof window !== "undefined") {
    const overrideUrl = (window as unknown as { __MAGIC_CONTROLLER_URL__?: string })
      .__MAGIC_CONTROLLER_URL__;
    if (overrideUrl) return overrideUrl;
  }

  try {
    const baseUrl = client.getHomeserverUrl();
    if (!baseUrl) return null;
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.hostname}:8080`;
  } catch {
    return null;
  }
}

function handleMagicEvent(event: MatrixEvent, room: Room | undefined): void {
  if (!room) return;
  const type = event.getType();
  const content = event.getContent();
  const sender = event.getSender() ?? "";

  if (type === MAGIC_EVENTS.AGENT_STATUS) {
    const parsed = AgentStatusEvent.safeParse(content);
    if (parsed.success) {
      useAgentStore.getState().upsertAgent(room.roomId, parsed.data, sender);
    }
  } else if (type === MAGIC_EVENTS.TASK_ASSIGNMENT) {
    const parsed = TaskAssignmentEvent.safeParse(content);
    if (parsed.success) {
      useAgentStore.getState().upsertTask(room.roomId, parsed.data);
    }
  } else if (type === MAGIC_EVENTS.HEARTBEAT) {
    const agentId = (content as { agent_id?: string }).agent_id;
    if (agentId) {
      useAgentStore.getState().updateHeartbeat(agentId, event.getTs());
    }
  }
}

function syncRoomList(client: MatrixClient, sessionId: string): void {
  const roomStore = useRoomStore.getState();
  roomStore.initSession(sessionId);
  for (const room of client.getRooms()) {
    // Invite-state rooms live in inviteStore, not roomStore.
    if (room.getMyMembership() !== "join") continue;
    roomStore.upsertRoom(sessionId, room.roomId, {
      name: room.name,
      topic:
        room.currentState
          .getStateEvents("m.room.topic", "")
          ?.getContent()?.topic ?? "",
      memberCount: room.getJoinedMemberCount(),
      unreadCount: room.getUnreadNotificationCount(NotificationCountType.Total) ?? 0,
      highlightCount: room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0,
      isEncrypted: room.hasEncryptionStateEvent(),
      isDirect: !!room.getDMInviter(),
      lastActivityTs: room.getLastActiveTimestamp(),
    });

    // State events that landed during initial sync don't trigger
    // RoomStateEvent.Events on most paths — backfill them explicitly so the
    // agent dashboard reflects pre-existing Magic state on first load.
    const agentEvents = room.currentState.getStateEvents(MAGIC_EVENTS.AGENT_STATUS);
    for (const event of agentEvents) {
      handleMagicEvent(event, room);
    }
    const taskEvents = room.currentState.getStateEvents(MAGIC_EVENTS.TASK_ASSIGNMENT);
    for (const event of taskEvents) {
      handleMagicEvent(event, room);
    }
  }
}

/**
 * Pull every invite-state room out of the client and seed inviteStore.
 * Called once after the initial /sync hits PREPARED so invites that
 * arrived while the app was closed don't get lost.
 */
function syncInviteList(client: MatrixClient, sessionId: string): void {
  const inviteStore = useInviteStore.getState();
  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== "invite") continue;
    const invite = parseInvite(room, sessionId);
    if (invite) inviteStore.addInvite(invite);
  }
}

/**
 * Build a `RoomInvite` from a Room currently in invite state. Some
 * fields come from `invite_state` events (a stripped subset of
 * `m.room.*` state) and may be missing — fall back to neutral values
 * so the UI can render "未命名房间" rather than crashing.
 */
function parseInvite(room: Room, sessionId: string): RoomInvite | null {
  try {
    const nameEvent = room.currentState.getStateEvents("m.room.name", "");
    const roomName =
      (nameEvent?.getContent() as { name?: string } | undefined)?.name ?? null;

    const avatarEvent = room.currentState.getStateEvents("m.room.avatar", "");
    const roomAvatarMxc =
      (avatarEvent?.getContent() as { url?: string } | undefined)?.url ??
      null;

    const myUserId = room.myUserId;
    let inviterId = "";
    let inviterName = "";
    const memberEvents = room.currentState.getStateEvents("m.room.member");
    for (const event of memberEvents) {
      if (
        event.getStateKey() === myUserId &&
        (event.getContent() as { membership?: string } | undefined)
          ?.membership === "invite"
      ) {
        inviterId = event.getSender() ?? "";
        const inviterMember = inviterId
          ? room.currentState.getMember(inviterId)
          : null;
        inviterName = inviterMember?.name ?? extractDisplayName(inviterId);
        break;
      }
    }

    const isEncrypted = !!room.currentState.getStateEvents(
      "m.room.encryption",
      "",
    );
    const isDirect = !!room.getDMInviter();

    return {
      roomId: room.roomId,
      roomName,
      roomAvatarMxc,
      inviterId,
      inviterName,
      isDirect,
      isEncrypted,
      timestamp: Date.now(),
      status: "pending",
      sessionId,
    };
  } catch (err) {
    console.error("解析邀请失败:", (err as Error).message);
    return null;
  }
}

function extractDisplayName(userId: string): string {
  return userId.match(/^@([^:]+)/)?.[1] ?? userId;
}

function mapSyncState(sdkState: string): SyncState {
  switch (sdkState) {
    case "PREPARED": return "PREPARED";
    case "SYNCING": return "SYNCING";
    case "ERROR": return "ERROR";
    case "RECONNECTING": return "RECONNECTING";
    case "STOPPED": return "STOPPED";
    default: return "SYNCING";
  }
}
