import { z } from "zod";

export const MAGIC_EVENTS = {
  AGENT_STATUS: "com.magic.agent.status",
  TASK_ASSIGNMENT: "com.magic.task.assignment",
  SOUL_CONTENT: "com.magic.soul.content",
  MEMORY_CONTENT: "com.magic.memory.content",
  HEARTBEAT: "com.magic.heartbeat",
} as const;

export const AgentStatusEvent = z.object({
  agent_id: z.string(),
  status: z.enum(["active", "idle", "offline", "error"]),
  capabilities: z.array(z.string()),
  model: z.string().optional(),
  current_task_id: z.string().nullable(),
  timestamp: z.number(),
});
export type AgentStatusEvent = z.infer<typeof AgentStatusEvent>;

export const TaskAssignmentEvent = z.object({
  task_id: z.string(),
  title: z.string(),
  assignee: z.string(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["pending", "in_progress", "completed", "failed"]),
  due_date: z.string().optional(),
  description: z.string().optional(),
});
export type TaskAssignmentEvent = z.infer<typeof TaskAssignmentEvent>;

export const SoulContentEvent = z.object({
  content: z.string(),
  file_type: z.enum(["soul", "memory"]),
  version: z.number(),
  editor: z.string(),
});
export type SoulContentEvent = z.infer<typeof SoulContentEvent>;
