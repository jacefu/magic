import {
  createClient,
  NotificationCountType,
  type MatrixClient,
} from "matrix-js-sdk";
import type { PersistedSession } from "@magic/shared-types";
import { bridgeToStores } from "./bridge.js";
import {
  loadPersistedSessions as loadEncryptedSessions,
  savePersistedSessions as saveEncryptedSessions,
} from "./session-persistence.js";
import { recordInstanceLogin } from "./recent-instances.js";
import { useAuthStore } from "./stores/authStore.js";
import { useDmStore } from "./stores/dmStore.js";
import { useRoomStore } from "./stores/roomStore.js";
import { useSessionStore, type ServerSession } from "./stores/sessionStore.js";
import { useTypingStore } from "./stores/typingStore.js";

/**
 * Per-session MatrixClient instances. Kept outside React state because
 * the SDK keeps internal mutable state (rooms map, sync token, crypto
 * stores) that doesn't belong in a Zustand store.
 */
const clients = new Map<string, MatrixClient>();

/**
 * Bridge cleanups, one per session. After Spec 017 every session has
 * its own bridge running concurrently — writes are partitioned by
 * sessionId in roomStore / typingStore so they don't contaminate each
 * other. Cleanup runs on logout.
 */
const bridgeCleanups = new Map<string, () => void>();

/**
 * Per-session badge / sync-state listeners. These run for *every*
 * session (not just the active one) so the workspace rail can show
 * spinners and unread counts for inactive servers.
 */
const sessionWatchers = new Map<string, () => void>();

/**
 * Spec 017 BUG-5: pollers attached to inactive sessions to keep their
 * unread badges fresh on the workspace rail. The MatrixClient long-poll
 * itself is left running so notifications still arrive (AC-8); this
 * timer is a safety belt for environments where the per-room
 * `Room.unreadNotifications` event might be missed.
 */
const inactivePollers = new Map<string, ReturnType<typeof setInterval>>();
const INACTIVE_POLL_INTERVAL_MS = 30_000;

/**
 * Upper bound for `loginWithPassword`. matrix-js-sdk doesn't apply one
 * itself, and the underlying `fetch` inherits the OS DNS timeout —
 * 60-120s on macOS for a hostname that doesn't resolve. Bound it here
 * so the UI gets a clean rejection well within human patience.
 */
const LOGIN_TIMEOUT_MS = 20_000;

/**
 * Caps for `removeServer`'s best-effort server-side cleanup. The
 * local state has already been torn down by the time we reach these,
 * so the user has long since seen the UI return to the welcome
 * screen — these timers just stop us holding open a network call
 * forever against a dead homeserver.
 */
const LOGOUT_TIMEOUT_MS = 5_000;
const CLEAR_STORES_TIMEOUT_MS = 5_000;

/**
 * Cap for `client.initRustCrypto()` during session restore. The call
 * is local (WASM init + IndexedDB open) so the happy path is sub-
 * second; on modern hardware even a cold launch is comfortably under
 * 5 s. A corrupt IDB store has been seen to hang it forever — the
 * timeout lets the for-loop move on and ultimately reach
 * `progressCallback?.(null)` so the splash clears. Sessions whose
 * crypto init exceeds this cap are dropped from the persisted list
 * so the next launch doesn't trip on the same broken state.
 */
const INIT_CRYPTO_TIMEOUT_MS = 10_000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * Reported by `restoreAllSessions` once per session as it goes. `null`
 * is emitted when the restore loop finishes (or there's nothing to
 * restore) so the UI can clear the splash.
 */
export interface RestoreProgress {
  current: number;
  total: number;
  serverName: string;
}

let progressCallback: ((progress: RestoreProgress | null) => void) | null =
  null;

/** Subscribe to restore progress. Pass `null` to unsubscribe. */
export function onRestoreProgress(
  cb: ((progress: RestoreProgress | null) => void) | null,
): void {
  progressCallback = cb;
}

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
  // matrix-js-sdk's loginWithPassword has no client-side timeout, so a
  // bad DNS lookup or unresponsive homeserver leaves the dialog stuck
  // on "连接中…" forever. Bound it explicitly so the UI gets a
  // rejectable promise on slow / unreachable hosts.
  const response = await withTimeout(
    tempClient.loginWithPassword(username, password),
    LOGIN_TIMEOUT_MS,
    "服务器无响应，请检查地址或网络",
  );
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
    initialSyncComplete: false,
    unreadCount: 0,
    highlightCount: 0,
    addedAt: Date.now(),
  };
  useSessionStore.getState().addSession(session);

  // Watchers run for every session — they keep the workspace icon
  // spinner + unread badge live regardless of which session is active.
  registerSessionWatchers(sessionId, client);

  // Concurrent bridges: every session has its own bridge writing to its
  // own per-session partition in roomStore / typingStore. Adding a new
  // server doesn't disturb other sessions' bridges.
  activateBridge(sessionId);

  if (useSessionStore.getState().activeSessionId === sessionId) {
    useRoomStore.getState().setActiveSession(sessionId);
    useTypingStore.getState().setActiveSession(sessionId);
    syncAuthStoreFromActive();
  }
  throttleInactiveSessions(useSessionStore.getState().activeSessionId);

  // Kick off the sync loop without awaiting it. `startClient` only
  // resolves once the initial /sync round-trip completes — on a busy
  // account that's many seconds, and a transient hang would block the
  // login button forever ("连接中…"). Login itself already succeeded
  // (`loginWithPassword` returned), so we persist + return and let
  // the workspace icon's spinner reflect the in-flight sync.
  void client
    .startClient({ initialSyncLimit: 20, lazyLoadMembers: true })
    .catch((err) => {
      console.warn(
        `startClient failed for ${session.serverName}:`,
        (err as Error).message,
      );
    });

  void persistSessions();

  // Remember this instance for the WelcomePage quick-connect list.
  // Survives logout — the recent-instances store is independent of the
  // (encrypted) sessions blob.
  recordInstanceLogin({
    url: homeserver,
    username,
    name: serverName,
    initial: session.serverInitial,
    color: session.serverColor ?? "#5865F2",
    iconDataUrl: null,
  });

  return sessionId;
}

/**
 * Switch the active session. Spec 017: trivially cheap — every
 * session's data already lives in its own partition, so we just toggle
 * `activeSessionId` on the partitioned stores and the UI re-reads
 * from the matching slice.
 */
export function switchSession(targetSessionId: string): void {
  const store = useSessionStore.getState();
  if (store.activeSessionId === targetSessionId) return;
  if (!clients.has(targetSessionId)) return;

  store.setActiveSession(targetSessionId);
  useRoomStore.getState().setActiveSession(targetSessionId);
  useTypingStore.getState().setActiveSession(targetSessionId);
  syncAuthStoreFromActive();
  throttleInactiveSessions(targetSessionId);
  void persistSessions();
}

/**
 * Update the workspace-rail appearance of a logged-in session
 * (display name, single-letter avatar, colour) and persist the
 * change so it survives a relaunch. The serverName / serverInitial
 * / serverColor fields already live on the persisted shape — this
 * helper just bundles the store mutation + save.
 */
export async function updateServerAppearance(
  sessionId: string,
  updates: {
    serverName?: string;
    serverInitial?: string;
    serverColor?: string | null;
    iconDataUrl?: string | null;
  },
): Promise<void> {
  const session = useSessionStore.getState().sessions[sessionId];
  if (!session) return;
  useSessionStore.getState().updateSession(sessionId, updates);
  await persistSessions();
}

/**
 * Logout and remove a server. If it was the active session, the next
 * session in the list (if any) is activated; otherwise auth state
 * resets.
 *
 * Order of operations matters: we update local state and persist the
 * smaller session list BEFORE attempting the server-side logout.
 * The network logout was previously the first await and could hang
 * indefinitely on an offline / unreachable homeserver — that left
 * the user clicking "断开" with no visible effect because the store
 * mutation lived behind the hung promise. Persistence-first means the
 * UI returns to WelcomePage immediately; the server-side token
 * invalidation becomes best-effort and is bounded by a short timeout.
 */
export async function removeServer(sessionId: string): Promise<void> {
  const wasActive =
    useSessionStore.getState().activeSessionId === sessionId;

  bridgeCleanups.get(sessionId)?.();
  bridgeCleanups.delete(sessionId);
  sessionWatchers.get(sessionId)?.();
  sessionWatchers.delete(sessionId);
  const poller = inactivePollers.get(sessionId);
  if (poller) {
    clearInterval(poller);
    inactivePollers.delete(sessionId);
  }

  const client = clients.get(sessionId);

  // Step 1 — local teardown. This is what makes the UI react.
  if (client) {
    client.stopClient();
    client.removeAllListeners();
    clients.delete(sessionId);
  }
  useRoomStore.getState().removeSession(sessionId);
  useTypingStore.getState().removeSession(sessionId);
  useSessionStore.getState().removeSession(sessionId);

  if (wasActive) {
    const nextId = useSessionStore.getState().activeSessionId;
    if (nextId) {
      useRoomStore.getState().setActiveSession(nextId);
      useTypingStore.getState().setActiveSession(nextId);
      syncAuthStoreFromActive();
    } else {
      useAuthStore.getState().reset();
    }
  }
  throttleInactiveSessions(useSessionStore.getState().activeSessionId);

  // Step 2 — persist the (smaller / empty) session list. This is
  // awaited so a hard quit immediately after disconnect doesn't lose
  // the change.
  await persistSessions();

  // Step 3 — best-effort server-side cleanup. Bounded by short
  // timeouts because we already updated the user-visible state.
  if (client) {
    try {
      await withTimeout(
        client.logout(true),
        LOGOUT_TIMEOUT_MS,
        "logout timed out",
      );
    } catch {
      /* best-effort — server may be offline / token already invalid */
    }
    try {
      await withTimeout(
        client.clearStores(),
        CLEAR_STORES_TIMEOUT_MS,
        "clearStores timed out",
      );
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Wipe every session both in memory and on disk. Used by the
 * AuthGuard watchdog so the user can recover from a corrupt
 * persisted state ("正在恢复会话" stuck forever) without manually
 * editing electron-store / localStorage.
 */
export async function clearAllSessions(): Promise<void> {
  const ids = Array.from(clients.keys());
  for (const id of ids) {
    bridgeCleanups.get(id)?.();
    bridgeCleanups.delete(id);
    sessionWatchers.get(id)?.();
    sessionWatchers.delete(id);
    const poller = inactivePollers.get(id);
    if (poller) {
      clearInterval(poller);
      inactivePollers.delete(id);
    }
    const c = clients.get(id);
    if (c) {
      try {
        c.stopClient();
        c.removeAllListeners();
      } catch {
        /* best-effort */
      }
      clients.delete(id);
    }
  }
  useSessionStore.getState().reset();
  useRoomStore.getState().reset();
  useTypingStore.getState().reset();
  useAuthStore.getState().reset();
  await saveEncryptedSessions([], null);
}

/**
 * On app startup, restore every persisted session. Called once from
 * AuthGuard before deciding whether to show WelcomePage or main UI.
 */
export async function restoreAllSessions(): Promise<void> {
  const { sessions: saved, activeSessionId } = await loadEncryptedSessions();
  if (saved.length === 0) {
    progressCallback?.(null);
    return;
  }

  // Restore the user's last-active session pointer before we start
  // bridging — that way the first session whose sync hits PREPARED won't
  // accidentally claim the active slot if it isn't the right one.
  if (activeSessionId) {
    useSessionStore.setState({ activeSessionId });
  }

  const sessionsList: ServerSession[] = saved
    .map(
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
        iconDataUrl: s.iconDataUrl ?? null,
        syncState: "STOPPED",
        initialSyncComplete: false,
        unreadCount: 0,
        highlightCount: 0,
        addedAt: s.addedAt,
      }),
    )
    .sort((a, b) => a.addedAt - b.addedAt);

  // Track which session ids successfully made it into the in-memory
  // store. Any persisted session that *fails* to restore (timeout /
  // crypto error / etc.) is removed from the persisted list at the
  // end so the next launch doesn't retry the same broken state.
  const restoredIds = new Set<string>();

  for (let i = 0; i < sessionsList.length; i++) {
    const session = sessionsList[i]!;
    progressCallback?.({
      current: i + 1,
      total: sessionsList.length,
      serverName: session.serverName ?? session.homeserver,
    });
    try {
      // eslint-disable-next-line no-console
      console.log(
        `[session-manager] restoring ${session.serverName} (${i + 1}/${sessionsList.length})`,
      );
      const client = createClient({
        baseUrl: session.homeserver,
        accessToken: session.accessToken,
        userId: session.userId,
        deviceId: session.deviceId,
        timelineSupport: true,
        useAuthorizationHeader: true,
      });
      await withTimeout(
        client.initRustCrypto(),
        INIT_CRYPTO_TIMEOUT_MS,
        `initRustCrypto timed out for ${session.serverName}`,
      );
      clients.set(session.id, client);

      useSessionStore.getState().addSession(session);
      restoredIds.add(session.id);
      registerSessionWatchers(session.id, client);

      // Bridge every restored session immediately. Per-partition writes
      // mean concurrent bridges don't contaminate each other.
      activateBridge(session.id);

      if (useSessionStore.getState().activeSessionId === session.id) {
        useRoomStore.getState().setActiveSession(session.id);
        useTypingStore.getState().setActiveSession(session.id);
        syncAuthStoreFromActive();
      }

      // Fire-and-forget — same reasoning as addServer: blocking the
      // app boot on N initial syncs (one per persisted session) would
      // leave the user staring at the "正在恢复会话…" splash for a
      // minute on first launch.
      void client
        .startClient({ initialSyncLimit: 20, lazyLoadMembers: true })
        .catch((err) => {
          console.warn(
            `startClient failed for restored session ${session.serverName}:`,
            (err as Error).message,
          );
        });
      // eslint-disable-next-line no-console
      console.log(
        `[session-manager] restored ${session.serverName} ok`,
      );
    } catch (err) {
      console.warn(
        `Failed to restore session ${session.serverName}:`,
        (err as Error).message,
      );
    }
  }

  throttleInactiveSessions(useSessionStore.getState().activeSessionId);

  // If any session failed to restore, persist the shrunken list now
  // so the splash never has to retry it. Without this, a single
  // corrupt session would block the app on every launch even after
  // the timeout saved the current launch.
  if (restoredIds.size < sessionsList.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[session-manager] dropped ${sessionsList.length - restoredIds.size} unrestorable session(s) from persistence`,
    );
    void persistSessions();
  }

  progressCallback?.(null);
}

// ---- internals ----

function activateBridge(sessionId: string): void {
  const client = clients.get(sessionId);
  if (!client) return;
  bridgeCleanups.get(sessionId)?.();
  bridgeCleanups.set(sessionId, bridgeToStores(client, sessionId));
}

/**
 * Spec 017 BUG-5: stop polling the now-active session and start polling
 * the rest. The MatrixClient long-poll keeps running on every session
 * regardless — this timer just keeps the workspace-icon unread badge
 * fresh in case the per-room event is missed.
 */
function throttleInactiveSessions(activeSessionId: string | null): void {
  for (const [sessionId, client] of clients.entries()) {
    const existing = inactivePollers.get(sessionId);
    if (sessionId === activeSessionId) {
      if (existing) {
        clearInterval(existing);
        inactivePollers.delete(sessionId);
      }
      continue;
    }
    if (existing) continue;
    const poller = setInterval(() => {
      let total = 0;
      let highlight = 0;
      for (const room of client.getRooms()) {
        total +=
          room.getUnreadNotificationCount(NotificationCountType.Total) ?? 0;
        highlight +=
          room.getUnreadNotificationCount(NotificationCountType.Highlight) ??
          0;
      }
      useSessionStore.getState().updateSession(sessionId, {
        unreadCount: total,
        highlightCount: highlight,
      });
    }, INACTIVE_POLL_INTERVAL_MS);
    inactivePollers.set(sessionId, poller);
  }
}

/** Stop every inactive-session poller. Call on app shutdown. */
export function cleanupAllPollers(): void {
  for (const poller of inactivePollers.values()) {
    clearInterval(poller);
  }
  inactivePollers.clear();
}

function registerSessionWatchers(
  sessionId: string,
  client: MatrixClient,
): void {
  const onSync = (state: string) => {
    const updates: Partial<ServerSession> = {
      syncState: state as ServerSession["syncState"],
    };
    // First time we hit PREPARED, latch `initialSyncComplete = true` so
    // the workspace icon stops showing a spinner during steady-state
    // long-polling (which keeps cycling SYNCING ↔ PREPARED forever).
    if (state === "PREPARED") {
      const current = useSessionStore.getState().sessions[sessionId];
      if (current && !current.initialSyncComplete) {
        updates.initialSyncComplete = true;
        // Fetch the homeserver-side profile (display name + avatar)
        // and mirror into the session + authStore. Without this the
        // session.displayName stays null on cold restore even though
        // the user has a display name set on the server, and any
        // bubble / panel reading from authStore falls back to the
        // bare user-id localpart.
        const ownId = client.getUserId();
        if (ownId) {
          void client
            .getProfileInfo(ownId)
            .then((profile) => {
              const profileUpdates = {
                displayName:
                  (profile as { displayname?: string }).displayname ?? null,
                avatarMxc:
                  (profile as { avatar_url?: string }).avatar_url ?? null,
              };
              useSessionStore
                .getState()
                .updateSession(sessionId, profileUpdates);
              // Mirror to authStore if this is the active session.
              if (
                useSessionStore.getState().activeSessionId === sessionId
              ) {
                syncAuthStoreFromActive();
              }
            })
            .catch(() => {
              /* best-effort — no displayname is fine */
            });
        }
      }
    }
    useSessionStore.getState().updateSession(sessionId, updates);
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

async function persistSessions(): Promise<void> {
  const sessions: PersistedSession[] = Object.values(
    useSessionStore.getState().sessions,
  ).map((s) => ({
    iconDataUrl: s.iconDataUrl ?? null,
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
  try {
    await saveEncryptedSessions(sessions, activeSessionId);
  } catch {
    /* silent — best-effort persistence */
  }
}

/** Test-only: tear down everything and clear the in-memory state. */
export function __resetSessionsForTests(): void {
  for (const cleanup of bridgeCleanups.values()) cleanup();
  for (const cleanup of sessionWatchers.values()) cleanup();
  bridgeCleanups.clear();
  sessionWatchers.clear();
  cleanupAllPollers();
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
  useRoomStore.getState().reset();
  useTypingStore.getState().reset();
  useDmStore.getState().reset();
}
