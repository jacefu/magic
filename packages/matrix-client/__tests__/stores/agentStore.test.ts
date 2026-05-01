import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "../../src/stores/agentStore.js";
import type { AgentStatusEvent, TaskAssignmentEvent } from "@magic/shared-types";

const ROOM_A = "!a:example.com";
const ROOM_B = "!b:example.com";

beforeEach(() => {
  useAgentStore.getState().reset();
});

describe("agentStore", () => {
  describe("upsertAgent", () => {
    it("inserts a new agent", () => {
      const event: AgentStatusEvent = {
        agent_id: "worker-1",
        status: "active",
        capabilities: ["coding", "testing"],
        model: "claude-sonnet-4-5",
        current_task_id: null,
        timestamp: 1000,
      };
      useAgentStore.getState().upsertAgent(ROOM_A, event, "@alice:example.com");

      const agent = useAgentStore.getState().agents["worker-1"];
      expect(agent).toBeDefined();
      expect(agent.userId).toBe("@alice:example.com");
      expect(agent.roomId).toBe(ROOM_A);
      expect(agent.status).toBe("active");
      expect(agent.capabilities).toEqual(["coding", "testing"]);
      expect(agent.lastHeartbeat).toBe(1000);
    });

    it("updates an existing agent in place", () => {
      const base: AgentStatusEvent = {
        agent_id: "worker-1",
        status: "active",
        capabilities: ["a"],
        current_task_id: null,
        timestamp: 1000,
      };
      useAgentStore.getState().upsertAgent(ROOM_A, base, "@me");
      useAgentStore
        .getState()
        .upsertAgent(ROOM_A, { ...base, status: "idle", timestamp: 2000 }, "@me");

      const agent = useAgentStore.getState().agents["worker-1"];
      expect(agent.status).toBe("idle");
      expect(agent.lastHeartbeat).toBe(2000);
    });
  });

  describe("upsertTask", () => {
    it("inserts a new task with all fields", () => {
      const event: TaskAssignmentEvent = {
        task_id: "task-1",
        title: "Write tests",
        assignee: "@worker:example.com",
        priority: "high",
        status: "in_progress",
        due_date: "2026-06-01",
        description: "Add coverage",
      };
      useAgentStore.getState().upsertTask(ROOM_A, event);

      const task = useAgentStore.getState().tasks["task-1"];
      expect(task.title).toBe("Write tests");
      expect(task.priority).toBe("high");
      expect(task.status).toBe("in_progress");
      expect(task.dueDate).toBe("2026-06-01");
      expect(task.roomId).toBe(ROOM_A);
    });

    it("overwrites an existing task on status change", () => {
      const base: TaskAssignmentEvent = {
        task_id: "task-1",
        title: "Write tests",
        assignee: "@w",
        priority: "high",
        status: "pending",
      };
      useAgentStore.getState().upsertTask(ROOM_A, base);
      useAgentStore.getState().upsertTask(ROOM_A, { ...base, status: "completed" });
      expect(useAgentStore.getState().tasks["task-1"].status).toBe("completed");
    });
  });

  describe("updateHeartbeat", () => {
    it("updates lastHeartbeat for an existing agent", () => {
      const event: AgentStatusEvent = {
        agent_id: "worker-1",
        status: "active",
        capabilities: [],
        current_task_id: null,
        timestamp: 1000,
      };
      useAgentStore.getState().upsertAgent(ROOM_A, event, "@me");
      useAgentStore.getState().updateHeartbeat("worker-1", 5000);
      expect(useAgentStore.getState().agents["worker-1"].lastHeartbeat).toBe(5000);
    });

    it("is a no-op for unknown agent", () => {
      useAgentStore.getState().updateHeartbeat("ghost", 5000);
      expect(useAgentStore.getState().agents["ghost"]).toBeUndefined();
    });
  });

  describe("removeAgentsInRoom", () => {
    it("removes agents and tasks belonging to a room", () => {
      useAgentStore.getState().upsertAgent(
        ROOM_A,
        {
          agent_id: "a-room-a",
          status: "active",
          capabilities: [],
          current_task_id: null,
          timestamp: 1,
        },
        "@x",
      );
      useAgentStore.getState().upsertAgent(
        ROOM_B,
        {
          agent_id: "b-room-b",
          status: "active",
          capabilities: [],
          current_task_id: null,
          timestamp: 1,
        },
        "@y",
      );
      useAgentStore.getState().upsertTask(ROOM_A, {
        task_id: "t-room-a",
        title: "Foo",
        assignee: "@x",
        priority: "low",
        status: "pending",
      });

      useAgentStore.getState().removeAgentsInRoom(ROOM_A);

      expect(useAgentStore.getState().agents["a-room-a"]).toBeUndefined();
      expect(useAgentStore.getState().tasks["t-room-a"]).toBeUndefined();
      expect(useAgentStore.getState().agents["b-room-b"]).toBeDefined();
    });
  });

  describe("reset", () => {
    it("clears all agents and tasks", () => {
      useAgentStore.getState().upsertAgent(
        ROOM_A,
        {
          agent_id: "x",
          status: "active",
          capabilities: [],
          current_task_id: null,
          timestamp: 1,
        },
        "@x",
      );
      useAgentStore.getState().reset();
      expect(useAgentStore.getState().agents).toEqual({});
      expect(useAgentStore.getState().tasks).toEqual({});
    });
  });
});
