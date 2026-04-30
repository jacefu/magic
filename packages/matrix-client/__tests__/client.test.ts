import { describe, it, expect, vi, beforeEach } from "vitest";
import { initClient, getClient, destroyClient, hasClient } from "../src/client.js";

vi.mock("matrix-js-sdk", () => ({
  createClient: vi.fn(() => ({
    initRustCrypto: vi.fn().mockResolvedValue(undefined),
    stopClient: vi.fn(),
    removeAllListeners: vi.fn(),
  })),
}));

describe("client singleton", () => {
  beforeEach(async () => {
    await destroyClient();
  });

  it("getClient throws when not initialized", () => {
    expect(() => getClient()).toThrow("未初始化");
  });

  it("initClient creates a client", async () => {
    await initClient({ homeserver: "https://matrix.example.com", enableCrypto: false });
    expect(hasClient()).toBe(true);
  });

  it("destroyClient removes the client", async () => {
    await initClient({ homeserver: "https://matrix.example.com", enableCrypto: false });
    await destroyClient();
    expect(hasClient()).toBe(false);
  });

  it("initClient destroys existing client before creating new one", async () => {
    await initClient({ homeserver: "https://a.example.com", enableCrypto: false });
    const c1 = getClient();
    await initClient({ homeserver: "https://b.example.com", enableCrypto: false });
    const c2 = getClient();
    expect(c1).not.toBe(c2);
  });
});
