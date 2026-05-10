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
export { createDM } from "./dm.js";

// Messages
export { sendTextMessage, sendReply, sendReadReceipt, sendTyping, paginateBackwards } from "./messages.js";

// Files
export {
  uploadAndSendFile,
  mxcToHttp,
  fetchAuthenticatedMedia,
  updateProfileDisplayName,
  updateProfileAvatar,
} from "./files.js";

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
export {
  bridgeToStores,
  registerNotificationCallback,
  registerInviteNotificationCallback,
} from "./bridge.js";

// Invites (spec 018)
export {
  acceptInvite,
  declineInvite,
  declineAndBlockInvite,
  acceptAllInvitesFrom,
} from "./invites.js";

// Zustand stores
export { useAuthStore } from "./stores/authStore.js";
export type { AuthStage, AuthUser } from "./stores/authStore.js";
export { useSyncStore } from "./stores/syncStore.js";
export { useRoomStore } from "./stores/roomStore.js";
export { useTypingStore } from "./stores/typingStore.js";
export { useUserStore } from "./stores/userStore.js";
export { useUIStore } from "./stores/uiStore.js";
export { useAgentStore } from "./stores/agentStore.js";
export { useAgentRegistryStore } from "./stores/agentRegistryStore.js";
export { useNotificationStore } from "./stores/notificationStore.js";
export { useSessionStore } from "./stores/sessionStore.js";
export type { ServerSession } from "./stores/sessionStore.js";
export { useInviteStore } from "./stores/inviteStore.js";
export type { RoomInvite } from "./stores/inviteStore.js";
export { useDmStore } from "./stores/dmStore.js";

// Multi-server session manager (specs 016 + 017)
export {
  addServer,
  removeServer,
  clearAllSessions,
  switchSession,
  restoreAllSessions,
  getSessionClient,
  createSessionId,
  onRestoreProgress,
  cleanupAllPollers,
  updateServerAppearance,
} from "./session-manager.js";
export type { RestoreProgress } from "./session-manager.js";
export type { RoomData } from "./stores/roomStore.js";
export type { SyncState } from "./stores/syncStore.js";
export type { AgentData, TaskData } from "./stores/agentStore.js";
export type { RegisteredAgent } from "./stores/agentRegistryStore.js";
export type { NotificationLevel } from "./stores/notificationStore.js";

// Agent registry
export { fetchAgentRegistry } from "./agent-registry.js";

// Serializers
export { serializeEvent, serializeRoomMember } from "./serializers.js";
export type { SerializedMember } from "./serializers.js";

// Errors
export { MagicClientError, AuthError, SyncError, RoomError } from "./errors.js";

// Crypto
export {
  bootstrapEncryption,
  restoreKeyBackup,
  getDeviceTrustLevel,
  getOwnDevices,
  deleteDevice,
  getRoomEncryptionStatus,
  startDeviceVerification,
} from "./crypto.js";
export type {
  DeviceTrustLevel,
  RoomEncryptionStatus,
  BootstrapResult,
  DeviceInfo,
} from "./crypto.js";
