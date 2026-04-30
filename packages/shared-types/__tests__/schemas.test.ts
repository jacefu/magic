import { describe, it, expect } from "vitest";
import { AgentStatusEvent, TaskAssignmentEvent, SoulContentEvent, MAGIC_EVENTS } from "../src/index.js";

describe("MAGIC_EVENTS", () => {
  it("defines correct event type strings", () => {
    expect(MAGIC_EVENTS.AGENT_STATUS).toBe("com.magic.agent.status");
    expect(MAGIC_EVENTS.TASK_ASSIGNMENT).toBe("com.magic.task.assignment");
    expect(MAGIC_EVENTS.SOUL_CONTENT).toBe("com.magic.soul.content");
    expect(MAGIC_EVENTS.HEARTBEAT).toBe("com.magic.heartbeat");
  });
});

describe("AgentStatusEvent", () => {
  it("parses valid event", () => {
    const result = AgentStatusEvent.parse({
      agent_id: "agent-1",
      status: "active",
      capabilities: ["chat", "code"],
      current_task_id: null,
      timestamp: Date.now(),
    });
    expect(result.agent_id).toBe("agent-1");
    expect(result.status).toBe("active");
  });

  it("rejects invalid status", () => {
    expect(() =>
      AgentStatusEvent.parse({
        agent_id: "agent-1",
        status: "unknown",
        capabilities: [],
        current_task_id: null,
        timestamp: Date.now(),
      }),
    ).toThrow();
  });
});

describe("TaskAssignmentEvent", () => {
  it("parses valid event", () => {
    const result = TaskAssignmentEvent.parse({
      task_id: "task-1",
      title: "Test Task",
      assignee: "agent-1",
      priority: "high",
      status: "pending",
    });
    expect(result.task_id).toBe("task-1");
    expect(result.priority).toBe("high");
  });
});

describe("SoulContentEvent", () => {
  it("parses valid event", () => {
    const result = SoulContentEvent.parse({
      content: "soul content here",
      file_type: "soul",
      version: 1,
      editor: "user-1",
    });
    expect(result.file_type).toBe("soul");
    expect(result.version).toBe(1);
  });
});
