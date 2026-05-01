import {
  ClientEvent,
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
} from "@magic/shared-types";
import { useSyncStore, type SyncState } from "./stores/syncStore.js";
import { useRoomStore } from "./stores/roomStore.js";
import { useTypingStore } from "./stores/typingStore.js";
import { useAgentStore } from "./stores/agentStore.js";
import { serializeEvent } from "./serializers.js";

export function bridgeToStores(client: MatrixClient): () => void {
  const onSync = (
    state: string,
    _prevState: string | null,
    data?: { error?: Error },
  ) => {
    const syncStore = useSyncStore.getState();
    syncStore.setSyncState(mapSyncState(state));
    if (state === "PREPARED") {
      syncStore.setInitialSyncComplete();
      syncRoomList(client);
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
    useRoomStore.getState().addMessage(room.roomId, serializeEvent(event));
  };
  client.on(RoomEvent.Timeline, onTimeline);

  const onRoomName = (room: Room) => {
    useRoomStore.getState().upsertRoom(room.roomId, { name: room.name });
  };
  client.on(RoomEvent.Name, onRoomName);

  const onUnreadCount = (room: Room) => {
    useRoomStore.getState().setUnreadCount(
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
    useTypingStore.getState().setTyping(member.roomId, member.userId, member.typing);
  };
  client.on(RoomMemberEvent.Typing, onTyping);

  const onMembership = (room: Room, membership: string) => {
    if (membership === "leave") {
      useRoomStore.getState().removeRoom(room.roomId);
    }
  };
  client.on(RoomEvent.MyMembership, onMembership);

  // Magic custom events: agent status, task assignment, heartbeat
  const handleMagicEvent = (event: MatrixEvent, room: Room | undefined) => {
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
  };
  const onTimelineMagic = (event: MatrixEvent, room: Room | undefined) => {
    handleMagicEvent(event, room);
  };
  const onStateEventMagic = (event: MatrixEvent) => {
    const room = client.getRoom(event.getRoomId() ?? "");
    handleMagicEvent(event, room ?? undefined);
  };
  client.on(RoomEvent.Timeline, onTimelineMagic);
  client.on(RoomStateEvent.Events, onStateEventMagic);

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
  };
}

function syncRoomList(client: MatrixClient): void {
  const roomStore = useRoomStore.getState();
  for (const room of client.getRooms()) {
    roomStore.upsertRoom(room.roomId, {
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
  }
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
