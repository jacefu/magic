// Client lifecycle
export { initClient, getClient, destroyClient, hasClient } from "./client.js";
export type { InitClientOptions } from "./client.js";

// Auth
export { login, logout, restoreSession } from "./auth.js";

// Sync
export { startSync, stopSync } from "./sync.js";
export type { SyncOptions } from "./sync.js";

// Rooms
export { createRoom, joinRoom, leaveRoom, inviteUser, getRooms, getRoom } from "./rooms.js";
export type { CreateRoomOptions } from "./rooms.js";

// Messages
export { sendTextMessage, sendReply, sendReadReceipt, sendTyping, paginateBackwards } from "./messages.js";

// Files
export { uploadAndSendFile, mxcToHttp } from "./files.js";

// Magic custom events
export {
  sendAgentStatus,
  sendTaskAssignment,
  sendSoulContent,
  getAgentStatuses,
  getTaskAssignments,
  getSoulContent,
} from "./custom-events.js";

// Bridge
export { bridgeToStores } from "./bridge.js";

// Zustand stores
export { useSyncStore } from "./stores/syncStore.js";
export { useRoomStore } from "./stores/roomStore.js";
export { useTypingStore } from "./stores/typingStore.js";
export { useUserStore } from "./stores/userStore.js";
export { useUIStore } from "./stores/uiStore.js";
export type { RoomData } from "./stores/roomStore.js";
export type { SyncState } from "./stores/syncStore.js";

// Serializers
export { serializeEvent, serializeRoomMember } from "./serializers.js";
export type { SerializedMember } from "./serializers.js";

// Errors
export { MagicClientError, AuthError, SyncError, RoomError } from "./errors.js";
