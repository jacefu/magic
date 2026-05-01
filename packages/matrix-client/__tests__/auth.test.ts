import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, logout, restoreSession } from "../src/auth.js";

const mockClient = {
  initRustCrypto: vi.fn().mockResolvedValue(undefined),
  stopClient: vi.fn(),
  removeAllListeners: vi.fn(),
  clearStores: vi.fn().mockResolvedValue(undefined),
  loginWithPassword: vi.fn().mockResolvedValue({
    user_id: "@alice:example.com",
    device_id: "DEVICE1",
    access_token: "tok123",
  }),
  logout: vi.fn().mockResolvedValue(undefined),
};

vi.mock("matrix-js-sdk", () => ({
  createClient: vi.fn(() => mockClient),
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("auth", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    mockClient.loginWithPassword.mockResolvedValue({
      user_id: "@alice:example.com",
      device_id: "DEVICE1",
      access_token: "tok123",
    });
    mockClient.logout.mockResolvedValue(undefined);
  });

  it("login returns a LoginResponse and saves session", async () => {
    const result = await login("https://matrix.example.com", "alice", "password");
    expect(result.userId).toBe("@alice:example.com");
    expect(result.deviceId).toBe("DEVICE1");
    expect(result.accessToken).toBe("tok123");
    expect(localStorageMock.getItem("magic_session")).not.toBeNull();
  });

  it("restoreSession returns false when no session", async () => {
    const result = await restoreSession();
    expect(result).toBe(false);
  });

  it("restoreSession returns true when session exists", async () => {
    await login("https://matrix.example.com", "alice", "password");
    const result = await restoreSession();
    expect(result).toBe(true);
  });

  it("logout clears session", async () => {
    await login("https://matrix.example.com", "alice", "password");
    await logout();
    expect(localStorageMock.getItem("magic_session")).toBeNull();
  });
});
