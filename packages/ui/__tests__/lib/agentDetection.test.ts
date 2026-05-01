import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  useAgentStore,
  useAgentRegistryStore,
  usePresenceStore,
  useUserActivityStore,
} from "@magic/matrix-client";
import {
  getAgentInfo,
  getHumanOnlineStatus,
  getStatusColor,
} from "../../src/lib/agentDetection.js";

const ROOM = "!r:example.com";
const NOW = 1_700_000_000_000;

beforeEach(() => {
  useAgentStore.getState().reset();
  useAgentRegistryStore.getState().reset();
  usePresenceStore.getState().reset();
  useUserActivityStore.getState().reset();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getAgentInfo — layer 1 (CRD registry)", () => {
  it("returns isAgent=true when the registry knows the user", () => {
    useAgentRegistryStore.getState().setAgents([
      {
        userId: "@worker-alice:magic.com",
        name: "alice",
        runtime: "openclaw",
        role: "worker",
      },
    ]);
    const info = getAgentInfo("@worker-alice:magic.com");
    expect(info.isAgent).toBe(true);
    expect(info.runtime).toBe("openclaw");
    expect(info.role).toBe("worker");
    expect(info.source).toBe("crd-api");
    expect(info.tagLabel).toBe("AGENT");
  });

  it("returns role=manager + tagLabel=MANAGER for managers", () => {
    useAgentRegistryStore.getState().setAgents([
      {
        userId: "@manager-bob:magic.com",
        name: "bob",
        runtime: "openclaw",
        role: "manager",
      },
    ]);
    const info = getAgentInfo("@manager-bob:magic.com");
    expect(info.role).toBe("manager");
    expect(info.tagLabel).toBe("MANAGER");
    expect(info.nameColor).toBe("#1ABC9C");
  });

  it("merges live agentStore status into the registry-sourced info", () => {
    useAgentRegistryStore.getState().setAgents([
      {
        userId: "@worker-alice:magic.com",
        name: "alice",
        runtime: "hermes",
        role: "worker",
      },
    ]);
    useAgentStore.getState().upsertAgent(
      ROOM,
      {
        agent_id: "alice-1",
        status: "active",
        capabilities: [],
        current_task_id: null,
        timestamp: NOW,
      },
      "@worker-alice:magic.com",
    );
    const info = getAgentInfo("@worker-alice:magic.com", ROOM);
    expect(info.source).toBe("crd-api");
    expect(info.status).toBe("online");
    expect(info.tagLabel).toBe("HERMES");
  });
});

describe("getAgentInfo — layer 2 (agentStore fallback)", () => {
  it("classifies an agent that emitted agent.status without registry presence", () => {
    useAgentStore.getState().upsertAgent(
      ROOM,
      {
        agent_id: "ghost-1",
        status: "active",
        capabilities: [],
        model: "qwenpaw-3.5",
        current_task_id: null,
        timestamp: NOW,
      },
      "@ghost:magic.com",
    );
    const info = getAgentInfo("@ghost:magic.com", ROOM);
    expect(info.isAgent).toBe(true);
    expect(info.source).toBe("agent-event");
    expect(info.runtime).toBe("qwenpaw");
    expect(info.tagLabel).toBe("QWENPAW");
  });

  it("flips active→offline when heartbeat is older than 60s", () => {
    useAgentStore.getState().upsertAgent(
      ROOM,
      {
        agent_id: "stale-1",
        status: "active",
        capabilities: [],
        current_task_id: null,
        timestamp: NOW - 120_000,
      },
      "@stale:magic.com",
    );
    const info = getAgentInfo("@stale:magic.com", ROOM);
    expect(info.status).toBe("offline");
  });
});

describe("getAgentInfo — layer 3 (name pattern, only on registry error)", () => {
  it("does NOT use name pattern when registry is still loading", () => {
    const info = getAgentInfo("@worker-test:magic.com");
    expect(info.isAgent).toBe(false);
  });

  it("uses name pattern only when registry has explicitly failed", () => {
    useAgentRegistryStore.getState().setError("network");
    const info = getAgentInfo("@worker-test:magic.com");
    expect(info.isAgent).toBe(true);
    expect(info.source).toBe("name-pattern");
    expect(info.role).toBe("worker");
  });

  it("recognizes manager pattern", () => {
    useAgentRegistryStore.getState().setError("network");
    const info = getAgentInfo("@manager-x:magic.com");
    expect(info.role).toBe("manager");
    expect(info.tagLabel).toBe("MANAGER");
  });

  it("recognizes hermes pattern", () => {
    useAgentRegistryStore.getState().setError("network");
    const info = getAgentInfo("@hermes-bot:magic.com");
    expect(info.runtime).toBe("hermes");
    expect(info.tagLabel).toBe("HERMES");
  });

  it("returns isAgent=false when nothing matches", () => {
    useAgentRegistryStore.getState().setError("network");
    const info = getAgentInfo("@plainuser:magic.com");
    expect(info.isAgent).toBe(false);
    expect(info.nameColor).toBe("#DBDEE1");
  });
});

describe("getHumanOnlineStatus", () => {
  it("returns offline when no presence data", () => {
    expect(getHumanOnlineStatus("@a:x")).toBe("offline");
  });

  it("maps online + currentlyActive → online", () => {
    usePresenceStore.getState().setPresence("@a:x", {
      presence: "online",
      currentlyActive: true,
    });
    expect(getHumanOnlineStatus("@a:x")).toBe("online");
  });

  it("maps online + lastActiveAgo > 5min → idle", () => {
    usePresenceStore.getState().setPresence("@a:x", {
      presence: "online",
      lastActiveAgo: 6 * 60 * 1000,
    });
    expect(getHumanOnlineStatus("@a:x")).toBe("idle");
  });

  it("maps unavailable → idle", () => {
    usePresenceStore.getState().setPresence("@a:x", { presence: "unavailable" });
    expect(getHumanOnlineStatus("@a:x")).toBe("idle");
  });

  it("maps offline → offline", () => {
    usePresenceStore.getState().setPresence("@a:x", { presence: "offline" });
    expect(getHumanOnlineStatus("@a:x")).toBe("offline");
  });
});

describe("activity fallback (Manager Agents and bots without agent.status)", () => {
  it("treats a registered Manager as online when they sent a recent message", () => {
    useAgentRegistryStore.getState().setAgents([
      {
        userId: "@manager:magic.com",
        name: "manager",
        runtime: "openclaw",
        role: "manager",
      },
    ]);
    // No agent.status event ever, but they chatted 30s ago.
    useUserActivityStore.getState().setLastSeen("@manager:magic.com", NOW - 30_000);
    const info = getAgentInfo("@manager:magic.com");
    expect(info.isAgent).toBe(true);
    expect(info.role).toBe("manager");
    expect(info.status).toBe("online");
  });

  it("stays offline when activity is older than 5 minutes", () => {
    useAgentRegistryStore.getState().setAgents([
      {
        userId: "@manager:magic.com",
        name: "manager",
        runtime: "openclaw",
        role: "manager",
      },
    ]);
    useUserActivityStore
      .getState()
      .setLastSeen("@manager:magic.com", NOW - 6 * 60_000);
    const info = getAgentInfo("@manager:magic.com");
    expect(info.status).toBe("offline");
  });

  it("activity overrides presence=offline (humans)", () => {
    usePresenceStore.getState().setPresence("@h:x", { presence: "offline" });
    useUserActivityStore.getState().setLastSeen("@h:x", NOW - 60_000);
    expect(getHumanOnlineStatus("@h:x")).toBe("online");
  });

  it("name-pattern Manager picks up activity-based online status", () => {
    useAgentRegistryStore.getState().setError("network");
    useUserActivityStore
      .getState()
      .setLastSeen("@manager-x:magic.com", NOW - 10_000);
    const info = getAgentInfo("@manager-x:magic.com");
    expect(info.source).toBe("name-pattern");
    expect(info.status).toBe("online");
  });
});

describe("getStatusColor", () => {
  it("uses agent path when user is in registry", () => {
    useAgentRegistryStore.getState().setAgents([
      {
        userId: "@w:m",
        name: "w",
        runtime: "openclaw",
        role: "worker",
      },
    ]);
    // No live agent.status event → status defaults to offline → grey
    expect(getStatusColor("@w:m")).toBe("#6D6F78");
  });

  it("returns green when agent is online", () => {
    useAgentRegistryStore.getState().setAgents([
      {
        userId: "@w:m",
        name: "w",
        runtime: "openclaw",
        role: "worker",
      },
    ]);
    useAgentStore.getState().upsertAgent(
      ROOM,
      {
        agent_id: "w",
        status: "active",
        capabilities: [],
        current_task_id: null,
        timestamp: NOW,
      },
      "@w:m",
    );
    expect(getStatusColor("@w:m", ROOM)).toBe("#23A55A");
  });

  it("returns yellow for human idle, green for online, grey for offline", () => {
    usePresenceStore.getState().setPresence("@h1:m", {
      presence: "online",
      currentlyActive: true,
    });
    usePresenceStore
      .getState()
      .setPresence("@h2:m", { presence: "unavailable" });
    expect(getStatusColor("@h1:m")).toBe("#23A55A");
    expect(getStatusColor("@h2:m")).toBe("#F0B232");
    expect(getStatusColor("@h3:m")).toBe("#6D6F78");
  });
});
