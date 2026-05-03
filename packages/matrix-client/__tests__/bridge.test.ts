import { describe, it, expect, vi, beforeEach } from "vitest";
import { bridgeToStores } from "../src/bridge.js";
import { useRoomStore } from "../src/stores/roomStore.js";
import { useSyncStore } from "../src/stores/syncStore.js";
import { ClientEvent, RoomEvent } from "matrix-js-sdk";

vi.mock("matrix-js-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("matrix-js-sdk")>();
  return {
    ...actual,
    createClient: vi.fn(),
  };
});

const SESSION_ID = "session_test";

function makeEventEmitter() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== handler);
    }),
    emit: (event: string, ...args: unknown[]) => {
      (handlers[event] ?? []).forEach((h) => h(...args));
    },
    getRooms: vi.fn().mockReturnValue([]),
    getHomeserverUrl: vi.fn().mockReturnValue(null),
    getRoom: vi.fn().mockReturnValue(null),
    _handlers: handlers,
  };
}

describe("bridgeToStores", () => {
  beforeEach(() => {
    useRoomStore.getState().reset();
    useSyncStore.getState().reset();
    useRoomStore.getState().setActiveSession(SESSION_ID);
  });

  it("returns a cleanup function", () => {
    const mockClient = makeEventEmitter();
    const cleanup = bridgeToStores(mockClient as never, SESSION_ID);
    expect(typeof cleanup).toBe("function");
  });

  it("cleanup removes all listeners", () => {
    const mockClient = makeEventEmitter();
    const cleanup = bridgeToStores(mockClient as never, SESSION_ID);
    const onCallCount = mockClient.on.mock.calls.length;
    cleanup();
    expect(mockClient.off.mock.calls.length).toBe(onCallCount);
  });

  it("sync PREPARED event triggers setInitialSyncComplete", () => {
    const mockClient = makeEventEmitter();
    bridgeToStores(mockClient as never, SESSION_ID);
    mockClient.emit(ClientEvent.Sync, "PREPARED", null, {});
    expect(useSyncStore.getState().initialSyncComplete).toBe(true);
    expect(useSyncStore.getState().syncState).toBe("PREPARED");
  });

  it("sync ERROR event sets error message", () => {
    const mockClient = makeEventEmitter();
    bridgeToStores(mockClient as never, SESSION_ID);
    mockClient.emit(ClientEvent.Sync, "ERROR", null, { error: new Error("network fail") });
    expect(useSyncStore.getState().lastSyncError).toBe("network fail");
  });

  it("RoomEvent.Name updates room name in store", () => {
    const mockClient = makeEventEmitter();
    bridgeToStores(mockClient as never, SESSION_ID);
    mockClient.emit(RoomEvent.Name, { roomId: "!r:example.com", name: "My Room" });
    expect(useRoomStore.getState().rooms["!r:example.com"]?.name).toBe("My Room");
  });

  it("RoomEvent.MyMembership leave removes room", () => {
    const mockClient = makeEventEmitter();
    bridgeToStores(mockClient as never, SESSION_ID);
    useRoomStore.getState().upsertRoom(SESSION_ID, "!r:example.com", { name: "Test" });
    mockClient.emit(RoomEvent.MyMembership, { roomId: "!r:example.com" }, "leave");
    expect(useRoomStore.getState().rooms["!r:example.com"]).toBeUndefined();
  });
});
