import {
  createClient,
  NotificationCountType,
  type MatrixClient,
} from "matrix-js-sdk";
import { bridgeToStores } from "./bridge.js";
import { useAuthStore } from "./stores/authStore.js";
import { useAgentStore } from "./stores/agentStore.js";
import { useAgentRegistryStore } from "./stores/agentRegistryStore.js";
import { useNotificationStore } from "./stores/notificationStore.js";
import { useRoomStore } from "./stores/roomStore.js";
import { useSessionStore, type ServerSession } from "./stores/sessionStore.js";
import { useTypingStore } from "./stores/typingStore.js";

const STORAGE_KEY = "magic_sessions";

/**
 * Per-session MatrixClient instances. Kept outside React state because
 * the SDK keeps internal mutable state (rooms map, sync token, crypto
 * stores) that doesn't belong in a Zustand store.
 */
const clients = new Map<string, MatrixClient>();

/**
 * Bridge cleanup is registered ONLY for the currently-active session.
 * All bridges write to the same global roomStore; running concurrent
 * bridges would mix events across servers. When the user switches we
 * tear the old bridge down and stand up a new one.
 */
const bridgeCleanups = new Map<string, () => void>();

/**
 * Per-session badge / sync-state listeners. These run for *every*
 * session (not just the active one) so the workspace rail can show
 * spinners and unread counts for inactive servers.
 */
const sessionWatchers = new Map<string, () => void>();

/** Stable id derived from the homeserver URL — same input → same id. */
export function createSessionId(homeserver: string): string {
  let hash = 0;
  for (let i = 0; i < homeserver.length; i++) {
    hash = (hash << 5) - hash + homeserver.charCodeAt(i);
    hash |= 0;
  }
  return `session_${Math.abs(hash).toString(36)}`;
}

/** Return the MatrixClient for a session id, falling back to the active one. */
export function getSessionClient(sessionId?: string): MatrixClient | null {
  const id = sessionId ?? useSessionStore.getState().activeSessionId;
  return id ? (clients.get(id) ?? null) : null;
}

/**
 * Login a new homeserver and add it as a workspace. Returns the new
 * session id. Throws on login failure (caller surfaces the error).
 */
export async function addServer(
  homeserver: string,
  username: string,
  password: string,
): Promise<string> {
  const sessionId = createSessionId(homeserver);

  // Already logged in to this homeserver — just switch.
  if (clients.has(sessionId)) {
    switchSession(sessionId);
    return sessionId;
  }

  // Stage 1: temp client to do the password login. We then throw it
  // away because loginWithPassword issues a fresh device id, and
  // initRustCrypto() needs to bind to that device id from construction.
  const tempClient = createClient({
    baseUrl: homeserver,
    timelineSupport: true,
    useAuthorizationHeader: true,
  });
  const response = await tempClient.loginWithPassword(username, password);
  tempClient.stopClient();
  await tempClient.clearStores().catch(() => {
    /* best-effort */
  });

  // Stage 2: real client wired up to the freshly-issued device id.
  const client = createClient({
    baseUrl: homeserver,
    accessToken: response.access_token,
    userId: response.user_id,
    deviceId: response.device_id,
    timelineSupport: true,
    useAuthorizationHeader: true,
  });
  await client.initRustCrypto();
  clients.set(sessionId, client);

  const serverName = deriveServerName(homeserver);
  const session: ServerSession = {
    id: sessionId,
    homeserver,
    userId: response.user_id,
    deviceId: response.device_id,
    accessToken: response.access_token,
    displayName: null,
    avatarMxc: null,
    serverName,
    serverInitial: serverName.charAt(0).toUpperCase() || "?",
    serverColor: pickColor(homeserver),
    syncState: "STOPPED",
    unreadCount: 0,
    highlightCount: 0,
    addedAt: Date.now(),
  };
  useSessionStore.getState().addSession(session);

  // Watchers run for every session — they keep the workspace icon
  // spinner + unread badge live regardless of which session is active.
  registerSessionWatchers(sessionId, client);

  // If this is now the active session (likely the very first one),
  // stand up the bridge BEFORE starting the client so initial-sync
  // events flow into the global stores.
  const isNowActive =
    useSessionStore.getState().activeSessionId === sessionId;
  if (isNowActive) {
    activateBridge(sessionId);
    syncAuthStoreFromActive();
  }

  await client.startClient({ initialSyncLimit: 20, lazyLoadMembers: true });
  persistSessions();
  return sessionId;
}

/**
 * Switch the active session. Tears down the old bridge, clears the
 * per-server UI stores, then re-bridges + re-populates from the new
 * client's already-known rooms.
 */
export function switchSession(targetSessionId: string): void {
  const store = useSessionStore.getState();
  const currentId = store.activeSessionId;
  if (currentId === targetSessionId) return;
  if (!clients.has(targetSessionId)) return;

  if (currentId) {
    bridgeCleanups.get(currentId)?.();
    bridgeCleanups.delete(currentId);
  }

  store.setActiveSession(targetSessionId);

  // Reset everything that's tied to a specific server.
  useRoomStore.getState().reset();
  useTypingStore.getState().reset();
  useAgentStore.getState().reset();
  useAgentRegistryStore.getState().reset();
  useNotificationStore.getState().setUnreadCounts(0, 0);

  activateBridge(targetSessionId);
  populateRoomStoreFromClient(targetSessionId);
  syncAuthStoreFromActive();
  persistSessions();
}

/**
 * Logout and remove a server. If it was the active session, the next
 * session in the list (if any) is activated; otherwise auth state
 * resets.
 */
export async function removeServer(sessionId: string): Promise<void> {
  const wasActive =
    useSessionStore.getState().activeSessionId === sessionId;

  if (wasActive) {
    bridgeCleanups.get(sessionId)?.();
    bridgeCleanups.delete(sessionId);
  }
  sessionWatchers.get(sessionId)?.();
  sessionWatchers.delete(sessionId);

  const client = clients.get(sessionId);
  if (client) {
    try {
      await client.logout(true);
    } catch {
      /* best-effort */
    }
    client.stopClient();
    await client.clearStores().catch(() => {
      /* best-effort */
    });
    client.removeAllListeners();
    clients.delete(sessionId);
  }

  useSessionStore.getState().removeSession(sessionId);
  persistSessions();

  if (wasActive) {
    useRoomStore.getState().reset();
    useTypingStore.getState().reset();
    useAgentStore.getState().reset();
    useAgentRegistryStore.getState().reset();
    useNotificationStore.getState().setUnreadCounts(0, 0);

    const nextId = useSessionStore.getState().activeSessionId;
    if (nextId) {
      activateBridge(nextId);
      populateRoomStoreFromClient(nextId);
      syncAuthStoreFromActive();
    } else {
      useAuthStore.getState().reset();
    }
  }
}

/**
 * On app startup, restore every persisted session. Called once from
 * AuthGuard before deciding whether to show WelcomePage or main UI.
 */
export async function restoreAllSessions(): Promise<void> {
  const saved = loadPersistedSessions();
  if (saved.length === 0) return;

  for (const session of saved) {
    try {
      const client = createClient({
        baseUrl: session.homeserver,
        accessToken: session.accessToken,
        userId: session.userId,
        deviceId: session.deviceId,
        timelineSupport: true,
        useAuthorizationHeader: true,
      });
      await client.initRustCrypto();
      clients.set(session.id, client);

      useSessionStore.getState().addSession(session);
      registerSessionWatchers(session.id, client);

      const isActive =
        useSessionStore.getState().activeSessionId === session.id;
      if (isActive) {
        activateBridge(session.id);
        syncAuthStoreFromActive();
      }
      await client.startClient({
        initialSyncLimit: 20,
        lazyLoadMembers: true,
      });
    } catch (err) {
      console.warn(
        `Failed to restore session ${session.serverName}:`,
        (err as Error).message,
      );
    }
  }
}

// ---- internals ----

function activateBridge(sessionId: string): void {
  const client = clients.get(sessionId);
  if (!client) return;
  bridgeCleanups.get(sessionId)?.();
  bridgeCleanups.set(sessionId, bridgeToStores(client));
}

function populateRoomStoreFromClient(sessionId: string): void {
  const client = clients.get(sessionId);
  if (!client) return;
  const roomStore = useRoomStore.getState();
  for (const room of client.getRooms()) {
    roomStore.upsertRoom(room.roomId, {
      name: room.name,
      topic:
        room.currentState
          .getStateEvents("m.room.topic", "")
          ?.getContent()?.topic ?? "",
      memberCount: room.getJoinedMemberCount(),
      unreadCount:
        room.getUnreadNotificationCount(NotificationCountType.Total) ?? 0,
      highlightCount:
        room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0,
      isEncrypted: room.hasEncryptionStateEvent(),
      isDirect: !!room.getDMInviter(),
      lastActivityTs: room.getLastActiveTimestamp(),
    });
  }
}

function registerSessionWatchers(
  sessionId: string,
  client: MatrixClient,
): void {
  const onSync = (state: string) => {
    useSessionStore.getState().updateSession(sessionId, {
      syncState: state as ServerSession["syncState"],
    });
  };
  const recomputeUnread = () => {
    let total = 0;
    let highlight = 0;
    for (const room of client.getRooms()) {
      total +=
        room.getUnreadNotificationCount(NotificationCountType.Total) ?? 0;
      highlight +=
        room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0;
    }
    useSessionStore.getState().updateSession(sessionId, {
      unreadCount: total,
      highlightCount: highlight,
    });
  };

  // matrix-js-sdk's typed event maps don't include the raw event-name
  // strings cleanly, so cast through the standard EventEmitter signature.
  const emitter = client as unknown as {
    on(name: string, h: (...args: unknown[]) => void): void;
    off(name: string, h: (...args: unknown[]) => void): void;
  };
  emitter.on("sync", onSync as (...args: unknown[]) => void);
  emitter.on(
    "Room.unreadNotifications",
    recomputeUnread as (...args: unknown[]) => void,
  );
  emitter.on(
    "Room.timeline",
    recomputeUnread as (...args: unknown[]) => void,
  );

  sessionWatchers.set(sessionId, () => {
    emitter.off("sync", onSync as (...args: unknown[]) => void);
    emitter.off(
      "Room.unreadNotifications",
      recomputeUnread as (...args: unknown[]) => void,
    );
    emitter.off(
      "Room.timeline",
      recomputeUnread as (...args: unknown[]) => void,
    );
  });
}

/**
 * Mirror the active session into authStore so the rest of the app
 * (MessageBubble, MentionPill, useSoulMemory, …) can keep reading
 * `useAuthStore.userId` / `homeserver` as a "current user" view.
 */
function syncAuthStoreFromActive(): void {
  const session = useSessionStore.getState().getActiveSession();
  if (!session) {
    useAuthStore.getState().reset();
    return;
  }
  useAuthStore.getState().setUser({
    userId: session.userId,
    homeserver: session.homeserver,
    displayName: session.displayName ?? undefined,
    avatarMxc: session.avatarMxc ?? undefined,
  });
  useAuthStore.getState().setStage("authenticated");
}

function deriveServerName(homeserver: string): string {
  try {
    const host = new URL(homeserver).hostname;
    return host.split(".")[0] || host;
  } catch {
    return homeserver;
  }
}

function pickColor(seed: string): string {
  const colors = [
    "#5865F2",
    "#23A55A",
    "#F0B232",
    "#EB459E",
    "#ED4245",
    "#57F287",
    "#FEE75C",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] ?? "#5865F2";
}

// ---- persistence ----

interface PersistedSession {
  id: string;
  homeserver: string;
  userId: string;
  deviceId: string;
  accessToken: string;
  serverName: string;
  serverInitial: string;
  serverColor: string | null;
  addedAt: number;
}

function persistSessions(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const sessions: PersistedSession[] = Object.values(
      useSessionStore.getState().sessions,
    ).map((s) => ({
      id: s.id,
      homeserver: s.homeserver,
      userId: s.userId,
      deviceId: s.deviceId,
      accessToken: s.accessToken,
      serverName: s.serverName,
      serverInitial: s.serverInitial,
      serverColor: s.serverColor,
      addedAt: s.addedAt,
    }));
    const activeSessionId = useSessionStore.getState().activeSessionId;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sessions, activeSessionId }),
    );
  } catch {
    /* silent */
  }
}

function loadPersistedSessions(): ServerSession[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as
      | { sessions: PersistedSession[]; activeSessionId: string | null }
      | PersistedSession[];
    const list = Array.isArray(parsed) ? parsed : (parsed.sessions ?? []);
    const sessions = list.map(
      (s): ServerSession => ({
        id: s.id,
        homeserver: s.homeserver,
        userId: s.userId,
        deviceId: s.deviceId,
        accessToken: s.accessToken,
        displayName: null,
        avatarMxc: null,
        serverName: s.serverName,
        serverInitial: s.serverInitial,
        serverColor: s.serverColor,
        syncState: "STOPPED",
        unreadCount: 0,
        highlightCount: 0,
        addedAt: s.addedAt,
      }),
    );
    if (!Array.isArray(parsed) && parsed.activeSessionId) {
      useSessionStore.setState({ activeSessionId: parsed.activeSessionId });
    }
    return sessions.sort((a, b) => a.addedAt - b.addedAt);
  } catch {
    return [];
  }
}

/** Test-only: tear down everything and clear the in-memory state. */
export function __resetSessionsForTests(): void {
  for (const cleanup of bridgeCleanups.values()) cleanup();
  for (const cleanup of sessionWatchers.values()) cleanup();
  bridgeCleanups.clear();
  sessionWatchers.clear();
  for (const c of clients.values()) {
    try {
      c.stopClient();
      c.removeAllListeners();
    } catch {
      /* best-effort */
    }
  }
  clients.clear();
  useSessionStore.getState().reset();
}
