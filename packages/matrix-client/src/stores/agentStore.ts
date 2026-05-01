import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { AgentStatusEvent, TaskAssignmentEvent } from "@magic/shared-types";

export interface AgentData {
  agentId: string;
  userId: string;
  status: AgentStatusEvent["status"];
  capabilities: string[];
  model?: string;
  currentTaskId: string | null;
  lastHeartbeat: number;
  roomId: string;
}

export interface TaskData {
  taskId: string;
  title: string;
  assignee: string;
  priority: TaskAssignmentEvent["priority"];
  status: TaskAssignmentEvent["status"];
  dueDate?: string;
  description?: string;
  roomId: string;
}

interface AgentStoreState {
  agents: Record<string, AgentData>;
  tasks: Record<string, TaskData>;

  upsertAgent: (roomId: string, event: AgentStatusEvent, sender: string) => void;
  upsertTask: (roomId: string, event: TaskAssignmentEvent) => void;
  updateHeartbeat: (agentId: string, timestamp: number) => void;
  removeAgentsInRoom: (roomId: string) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentStoreState>()(
  immer((set) => ({
    agents: {},
    tasks: {},

    upsertAgent: (roomId, event, sender) =>
      set((s) => {
        s.agents[event.agent_id] = {
          agentId: event.agent_id,
          userId: sender,
          status: event.status,
          capabilities: event.capabilities,
          model: event.model,
          currentTaskId: event.current_task_id,
          lastHeartbeat: event.timestamp,
          roomId,
        };
      }),

    upsertTask: (roomId, event) =>
      set((s) => {
        s.tasks[event.task_id] = {
          taskId: event.task_id,
          title: event.title,
          assignee: event.assignee,
          priority: event.priority,
          status: event.status,
          dueDate: event.due_date,
          description: event.description,
          roomId,
        };
      }),

    updateHeartbeat: (agentId, timestamp) =>
      set((s) => {
        if (s.agents[agentId]) {
          s.agents[agentId].lastHeartbeat = timestamp;
        }
      }),

    removeAgentsInRoom: (roomId) =>
      set((s) => {
        for (const id of Object.keys(s.agents)) {
          if (s.agents[id].roomId === roomId) delete s.agents[id];
        }
        for (const id of Object.keys(s.tasks)) {
          if (s.tasks[id].roomId === roomId) delete s.tasks[id];
        }
      }),

    reset: () => set({ agents: {}, tasks: {} }),
  })),
);
