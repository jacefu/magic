import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAgentStore } from "@magic/matrix-client";
import { useTaskBoard } from "../../src/hooks/useTaskBoard.js";
import type { TaskAssignmentEvent } from "@magic/shared-types";

const ROOM_A = "!a:example.com";
const ROOM_B = "!b:example.com";

function addTask(roomId: string, event: TaskAssignmentEvent) {
  useAgentStore.getState().upsertTask(roomId, event);
}

beforeEach(() => {
  useAgentStore.getState().reset();
});

describe("useTaskBoard", () => {
  it("returns empty when roomId is null", () => {
    const { result } = renderHook(() => useTaskBoard(null));
    expect(result.current.columns).toEqual([]);
    expect(result.current.totalTasks).toBe(0);
  });

  it("groups tasks into 4 status columns", () => {
    addTask(ROOM_A, {
      task_id: "1",
      title: "P",
      assignee: "@x",
      priority: "high",
      status: "pending",
    });
    addTask(ROOM_A, {
      task_id: "2",
      title: "I",
      assignee: "@x",
      priority: "high",
      status: "in_progress",
    });
    addTask(ROOM_A, {
      task_id: "3",
      title: "C",
      assignee: "@x",
      priority: "high",
      status: "completed",
    });
    addTask(ROOM_A, {
      task_id: "4",
      title: "F",
      assignee: "@x",
      priority: "high",
      status: "failed",
    });

    const { result } = renderHook(() => useTaskBoard(ROOM_A));
    expect(result.current.columns).toHaveLength(4);
    expect(result.current.columns.map((c) => c.key)).toEqual([
      "pending",
      "in_progress",
      "completed",
      "failed",
    ]);
    expect(result.current.totalTasks).toBe(4);
  });

  it("filters tasks by roomId", () => {
    addTask(ROOM_A, {
      task_id: "a",
      title: "in A",
      assignee: "@x",
      priority: "low",
      status: "pending",
    });
    addTask(ROOM_B, {
      task_id: "b",
      title: "in B",
      assignee: "@x",
      priority: "low",
      status: "pending",
    });

    const { result } = renderHook(() => useTaskBoard(ROOM_A));
    const allTasks = result.current.columns.flatMap((c) => c.tasks);
    expect(allTasks).toHaveLength(1);
    expect(allTasks[0].title).toBe("in A");
  });

  it("sorts tasks within a column by priority (critical → low)", () => {
    addTask(ROOM_A, {
      task_id: "low",
      title: "Low",
      assignee: "@x",
      priority: "low",
      status: "pending",
    });
    addTask(ROOM_A, {
      task_id: "crit",
      title: "Critical",
      assignee: "@x",
      priority: "critical",
      status: "pending",
    });
    addTask(ROOM_A, {
      task_id: "med",
      title: "Medium",
      assignee: "@x",
      priority: "medium",
      status: "pending",
    });
    addTask(ROOM_A, {
      task_id: "high",
      title: "High",
      assignee: "@x",
      priority: "high",
      status: "pending",
    });

    const { result } = renderHook(() => useTaskBoard(ROOM_A));
    const pendingCol = result.current.columns.find((c) => c.key === "pending")!;
    expect(pendingCol.tasks.map((t) => t.priority)).toEqual([
      "critical",
      "high",
      "medium",
      "low",
    ]);
  });

  it("returns empty tasks arrays for columns with no matching status", () => {
    addTask(ROOM_A, {
      task_id: "1",
      title: "Only completed",
      assignee: "@x",
      priority: "low",
      status: "completed",
    });
    const { result } = renderHook(() => useTaskBoard(ROOM_A));
    const pending = result.current.columns.find((c) => c.key === "pending")!;
    expect(pending.tasks).toEqual([]);
    const completed = result.current.columns.find((c) => c.key === "completed")!;
    expect(completed.tasks).toHaveLength(1);
  });

  it("totalTasks counts only tasks in the active room", () => {
    addTask(ROOM_A, {
      task_id: "a1",
      title: "x",
      assignee: "@x",
      priority: "low",
      status: "pending",
    });
    addTask(ROOM_A, {
      task_id: "a2",
      title: "y",
      assignee: "@x",
      priority: "low",
      status: "completed",
    });
    addTask(ROOM_B, {
      task_id: "b1",
      title: "z",
      assignee: "@x",
      priority: "low",
      status: "pending",
    });

    const { result } = renderHook(() => useTaskBoard(ROOM_A));
    expect(result.current.totalTasks).toBe(2);
  });
});
