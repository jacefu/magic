import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore, useAgentRegistryStore } from "@magic/matrix-client";
import { getAgentInfo } from "../../src/lib/agentDetection.js";

const ROOM = "!r:example.com";

beforeEach(() => {
  useAgentStore.getState().reset();
  useAgentRegistryStore.getState().reset();
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

  it("uses HERMES tag style for hermes runtime", () => {
    useAgentRegistryStore.getState().setAgents([
      {
        userId: "@worker-h:magic.com",
        name: "h",
        runtime: "hermes",
        role: "worker",
      },
    ]);
    const info = getAgentInfo("@worker-h:magic.com");
    expect(info.tagLabel).toBe("HERMES");
    expect(info.tagColor).toBe("#F47B67");
  });

  it("uses QWENPAW tag style for qwenpaw runtime", () => {
    useAgentRegistryStore.getState().setAgents([
      {
        userId: "@worker-q:magic.com",
        name: "q",
        runtime: "qwenpaw",
        role: "worker",
      },
    ]);
    const info = getAgentInfo("@worker-q:magic.com");
    expect(info.tagLabel).toBe("QWENPAW");
    expect(info.tagColor).toBe("#57F287");
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
        timestamp: Date.now(),
      },
      "@ghost:magic.com",
    );
    const info = getAgentInfo("@ghost:magic.com", ROOM);
    expect(info.isAgent).toBe(true);
    expect(info.source).toBe("agent-event");
    expect(info.runtime).toBe("qwenpaw");
    expect(info.tagLabel).toBe("QWENPAW");
  });

  it("infers hermes runtime from model string", () => {
    useAgentStore.getState().upsertAgent(
      ROOM,
      {
        agent_id: "h-1",
        status: "active",
        capabilities: [],
        model: "hermes-7b",
        current_task_id: null,
        timestamp: Date.now(),
      },
      "@h:magic.com",
    );
    const info = getAgentInfo("@h:magic.com", ROOM);
    expect(info.runtime).toBe("hermes");
  });

  it("scopes by roomId when one is supplied", () => {
    useAgentStore.getState().upsertAgent(
      ROOM,
      {
        agent_id: "x-1",
        status: "active",
        capabilities: [],
        current_task_id: null,
        timestamp: Date.now(),
      },
      "@x:magic.com",
    );
    expect(getAgentInfo("@x:magic.com", ROOM).isAgent).toBe(true);
    expect(getAgentInfo("@x:magic.com", "!other:room").isAgent).toBe(false);
  });
});

describe("getAgentInfo — layer 3 (name pattern, CRD-unavailable fallback)", () => {
  it("uses name pattern when registry hasn't loaded yet", () => {
    // loaded=false, no error — still allowed by spec § 4.4 ('!loaded || error')
    const info = getAgentInfo("@worker-test:magic.com");
    expect(info.isAgent).toBe(true);
    expect(info.source).toBe("name-pattern");
    expect(info.role).toBe("worker");
  });

  it("uses name pattern after registry has explicitly errored", () => {
    useAgentRegistryStore.getState().setError("network");
    const info = getAgentInfo("@worker-test:magic.com");
    expect(info.source).toBe("name-pattern");
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

  it("recognizes qwenpaw / copaw patterns", () => {
    useAgentRegistryStore.getState().setError("network");
    expect(getAgentInfo("@qwenpaw-1:magic.com").runtime).toBe("qwenpaw");
    expect(getAgentInfo("@copaw-2:magic.com").runtime).toBe("qwenpaw");
  });

  it("does NOT use name pattern after a successful registry load", () => {
    useAgentRegistryStore.getState().setAgents([]); // loaded=true, error=null
    const info = getAgentInfo("@worker-test:magic.com");
    expect(info.isAgent).toBe(false);
    expect(info.source).toBe("none");
  });

  it("returns isAgent=false when nothing matches", () => {
    useAgentRegistryStore.getState().setError("network");
    const info = getAgentInfo("@plainuser:magic.com");
    expect(info.isAgent).toBe(false);
    expect(info.nameColor).toBe("#DBDEE1");
  });
});
