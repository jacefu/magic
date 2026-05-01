import { describe, it, expect, beforeEach } from "vitest";
import {
  useAgentRegistryStore,
  type RegisteredAgent,
} from "../../src/stores/agentRegistryStore.js";

const alice: RegisteredAgent = {
  userId: "@worker-alice:magic.com",
  name: "alice",
  runtime: "openclaw",
  model: "claude-sonnet-4-5",
  role: "worker",
};

const manager: RegisteredAgent = {
  userId: "@manager-bob:magic.com",
  name: "bob",
  runtime: "openclaw",
  role: "manager",
};

beforeEach(() => {
  useAgentRegistryStore.getState().reset();
});

describe("agentRegistryStore", () => {
  describe("setAgents", () => {
    it("populates the agents map keyed by userId and marks loaded", () => {
      useAgentRegistryStore.getState().setAgents([alice, manager]);
      const state = useAgentRegistryStore.getState();
      expect(state.agents[alice.userId]).toEqual(alice);
      expect(state.agents[manager.userId]).toEqual(manager);
      expect(state.loaded).toBe(true);
      expect(state.error).toBeNull();
    });

    it("replaces previous agents on subsequent calls", () => {
      useAgentRegistryStore.getState().setAgents([alice]);
      useAgentRegistryStore.getState().setAgents([manager]);
      const state = useAgentRegistryStore.getState();
      expect(state.agents[alice.userId]).toBeUndefined();
      expect(state.agents[manager.userId]).toEqual(manager);
    });
  });

  describe("isAgent", () => {
    it("returns true for registered userIds", () => {
      useAgentRegistryStore.getState().setAgents([alice]);
      expect(useAgentRegistryStore.getState().isAgent(alice.userId)).toBe(true);
    });

    it("returns false for unknown userIds", () => {
      useAgentRegistryStore.getState().setAgents([alice]);
      expect(
        useAgentRegistryStore.getState().isAgent("@unknown:magic.com"),
      ).toBe(false);
    });
  });

  describe("getAgent", () => {
    it("returns the matching agent record", () => {
      useAgentRegistryStore.getState().setAgents([alice, manager]);
      expect(useAgentRegistryStore.getState().getAgent(manager.userId)).toEqual(
        manager,
      );
    });

    it("returns null for unknown userIds", () => {
      expect(useAgentRegistryStore.getState().getAgent("@ghost")).toBeNull();
    });
  });

  describe("setError", () => {
    it("stores error message and flips loaded to true", () => {
      useAgentRegistryStore.getState().setError("network down");
      const state = useAgentRegistryStore.getState();
      expect(state.error).toBe("network down");
      expect(state.loaded).toBe(true);
    });
  });

  describe("reset", () => {
    it("clears agents, loaded, and error", () => {
      useAgentRegistryStore.getState().setAgents([alice]);
      useAgentRegistryStore.getState().setError("boom");
      useAgentRegistryStore.getState().reset();
      const state = useAgentRegistryStore.getState();
      expect(state.agents).toEqual({});
      expect(state.loaded).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
