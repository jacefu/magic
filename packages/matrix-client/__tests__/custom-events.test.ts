import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendAgentStatus, getAgentStatuses } from "../src/custom-events.js";

const mockStateEvent = {
  getContent: vi.fn().mockReturnValue({
    agent_id: "agent-1",
    status: "active",
    capabilities: ["chat"],
    current_task_id: null,
    timestamp: 1000,
  }),
};

const mockRoom = {
  currentState: {
    getStateEvents: vi.fn().mockReturnValue([mockStateEvent]),
  },
};

const mockClient = {
  initRustCrypto: vi.fn().mockResolvedValue(undefined),
  stopClient: vi.fn(),
  removeAllListeners: vi.fn(),
  sendEvent: vi.fn().mockResolvedValue({ event_id: "$evt1" }),
  getRoom: vi.fn().mockReturnValue(mockRoom),
};

vi.mock("matrix-js-sdk", () => ({
  createClient: vi.fn(() => mockClient),
}));

import { initClient, destroyClient } from "../src/client.js";

describe("custom-events", () => {
  beforeEach(async () => {
    await destroyClient();
    await initClient({ homeserver: "https://matrix.example.com", enableCrypto: false });
    vi.clearAllMocks();
    mockClient.sendEvent.mockResolvedValue({ event_id: "$evt1" });
    mockClient.getRoom.mockReturnValue(mockRoom);
    mockRoom.currentState.getStateEvents.mockReturnValue([mockStateEvent]);
  });

  it("sendAgentStatus sends event and returns event_id", async () => {
    const id = await sendAgentStatus("!room:example.com", {
      agent_id: "agent-1",
      status: "active",
      capabilities: ["chat"],
      current_task_id: null,
      timestamp: Date.now(),
    });
    expect(id).toBe("$evt1");
  });

  it("sendAgentStatus throws on invalid data", async () => {
    await expect(
      sendAgentStatus("!room:example.com", {
        agent_id: "agent-1",
        status: "unknown" as "active",
        capabilities: [],
        current_task_id: null,
        timestamp: Date.now(),
      }),
    ).rejects.toThrow();
  });

  it("getAgentStatuses returns parsed events", () => {
    const statuses = getAgentStatuses("!room:example.com");
    expect(statuses).toHaveLength(1);
    expect(statuses[0].agent_id).toBe("agent-1");
  });
});
