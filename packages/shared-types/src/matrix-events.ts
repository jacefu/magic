import { z } from "zod";

export const MAGIC_EVENTS = {
  AGENT_STATUS: "com.magic.agent.status",
  TASK_ASSIGNMENT: "com.magic.task.assignment",
  SOUL_CONTENT: "com.magic.soul.content",
  MEMORY_CONTENT: "com.magic.memory.content",
  HEARTBEAT: "com.magic.heartbeat",
  // Spec 022 v3 — workspace folder binding state event. v3 dropped
  // the read_request / read_response / list_request / list_response /
  // tree_chunk types from v2 because Agents weren't going to
  // implement them; v3 ships file content as native Matrix
  // attachments instead. The state event survives so multi-device
  // / multi-client setups stay in sync about which room is bound.
  WORKSPACE_BINDING: "com.magic.workspace.binding",
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

// ---- Spec 022 v3: workspace folder binding ----

const WorkspaceFileEntrySchema = z.object({
  path: z.string(),
  size: z.number(),
  mtime: z.number(),
});
export type WorkspaceFileEntrySchema = z.infer<typeof WorkspaceFileEntrySchema>;

/**
 * State event posted by the Magic client when a user binds a folder.
 * Lightweight in v3: just metadata, no file tree (tree is shipped via
 * a regular m.text announcement message and Matrix-native attachments
 * the user triggers later — see spec §3.3).
 */
export const WorkspaceBindingEvent = z.object({
  bound: z.boolean(),
  displayName: z.string().optional(),
  boundBy: z.string().optional(),
  boundAt: z.number().optional(),
  fileCount: z.number().optional(),
});
export type WorkspaceBindingEvent = z.infer<typeof WorkspaceBindingEvent>;

// v2 schemas (read_request / read_response / list_request /
// list_response / tree_chunk) were removed — v3 ships file content
// as native Matrix m.file / m.image / inline-code-block messages
// instead, so there's no custom payload shape to validate.
