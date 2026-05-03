import { beforeEach, describe, expect, it } from "vitest";
import {
  useSessionStore,
  type ServerSession,
} from "../../src/stores/sessionStore.js";

beforeEach(() => {
  useSessionStore.getState().reset();
});

function makeSession(overrides: Partial<ServerSession> = {}): ServerSession {
  return {
    id: "session_a",
    homeserver: "https://a.example.com",
    userId: "@alice:a.example.com",
    deviceId: "DEV_A",
    accessToken: "token_a",
    displayName: null,
    avatarMxc: null,
    serverName: "a",
    serverInitial: "A",
    serverColor: "#5865F2",
    syncState: "STOPPED",
    initialSyncComplete: false,
    unreadCount: 0,
    highlightCount: 0,
    addedAt: 1000,
    ...overrides,
  };
}

describe("sessionStore", () => {
  describe("addSession", () => {
    it("adds a session to the map", () => {
      useSessionStore.getState().addSession(makeSession());
      expect(useSessionStore.getState().sessions["session_a"]).toBeDefined();
    });

    it("auto-activates the first session added", () => {
      useSessionStore.getState().addSession(makeSession());
      expect(useSessionStore.getState().activeSessionId).toBe("session_a");
    });

    it("does NOT change activeSessionId on subsequent adds", () => {
      useSessionStore.getState().addSession(makeSession());
      useSessionStore
        .getState()
        .addSession(makeSession({ id: "session_b", addedAt: 2000 }));
      expect(useSessionStore.getState().activeSessionId).toBe("session_a");
    });
  });

  describe("removeSession", () => {
    it("removes a session and promotes another to active when active was removed", () => {
      useSessionStore.getState().addSession(makeSession());
      useSessionStore
        .getState()
        .addSession(makeSession({ id: "session_b", addedAt: 2000 }));
      useSessionStore.getState().removeSession("session_a");
      const state = useSessionStore.getState();
      expect(state.sessions["session_a"]).toBeUndefined();
      expect(state.activeSessionId).toBe("session_b");
    });

    it("nulls activeSessionId when the last session is removed", () => {
      useSessionStore.getState().addSession(makeSession());
      useSessionStore.getState().removeSession("session_a");
      expect(useSessionStore.getState().activeSessionId).toBeNull();
    });

    it("keeps activeSessionId when a non-active session is removed", () => {
      useSessionStore.getState().addSession(makeSession());
      useSessionStore
        .getState()
        .addSession(makeSession({ id: "session_b", addedAt: 2000 }));
      useSessionStore.getState().removeSession("session_b");
      expect(useSessionStore.getState().activeSessionId).toBe("session_a");
    });

    it("is a no-op when the session id is unknown", () => {
      useSessionStore.getState().addSession(makeSession());
      useSessionStore.getState().removeSession("nonexistent");
      expect(useSessionStore.getState().activeSessionId).toBe("session_a");
    });
  });

  describe("updateSession", () => {
    it("merges partial updates into the existing record", () => {
      useSessionStore.getState().addSession(makeSession());
      useSessionStore
        .getState()
        .updateSession("session_a", { unreadCount: 5, syncState: "SYNCING" });
      const s = useSessionStore.getState().sessions["session_a"];
      expect(s.unreadCount).toBe(5);
      expect(s.syncState).toBe("SYNCING");
      // Other fields untouched
      expect(s.userId).toBe("@alice:a.example.com");
    });

    it("ignores updates for unknown ids", () => {
      useSessionStore.getState().addSession(makeSession());
      useSessionStore
        .getState()
        .updateSession("ghost", { unreadCount: 9 });
      expect(
        useSessionStore.getState().sessions["session_a"].unreadCount,
      ).toBe(0);
    });
  });

  describe("getSessionList", () => {
    it("orders sessions by addedAt ascending", () => {
      useSessionStore.getState().addSession(makeSession({ id: "b", addedAt: 2000 }));
      useSessionStore.getState().addSession(makeSession({ id: "a", addedAt: 1000 }));
      useSessionStore.getState().addSession(makeSession({ id: "c", addedAt: 3000 }));
      expect(useSessionStore.getState().getSessionList().map((s) => s.id))
        .toEqual(["a", "b", "c"]);
    });
  });

  describe("getActiveSession", () => {
    it("returns null when there's no active session", () => {
      expect(useSessionStore.getState().getActiveSession()).toBeNull();
    });
    it("returns the active session record", () => {
      useSessionStore.getState().addSession(makeSession());
      expect(useSessionStore.getState().getActiveSession()?.id).toBe("session_a");
    });
  });

  describe("setActiveSession", () => {
    it("switches the active id", () => {
      useSessionStore.getState().addSession(makeSession());
      useSessionStore
        .getState()
        .addSession(makeSession({ id: "session_b", addedAt: 2000 }));
      useSessionStore.getState().setActiveSession("session_b");
      expect(useSessionStore.getState().activeSessionId).toBe("session_b");
    });
  });

  describe("reset", () => {
    it("clears sessions and active id", () => {
      useSessionStore.getState().addSession(makeSession());
      useSessionStore.getState().setIsAddingServer(true);
      useSessionStore.getState().reset();
      const s = useSessionStore.getState();
      expect(s.sessions).toEqual({});
      expect(s.activeSessionId).toBeNull();
      expect(s.isAddingServer).toBe(false);
    });
  });
});
