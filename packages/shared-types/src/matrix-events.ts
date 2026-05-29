import { z } from "zod";

export const MAGIC_EVENTS = {
  AGENT_STATUS: "com.magic.agent.status",
  TASK_ASSIGNMENT: "com.magic.task.assignment",
  SOUL_CONTENT: "com.magic.soul.content",
  MEMORY_CONTENT: "com.magic.memory.content",
  HEARTBEAT: "com.magic.heartbeat",
} as const;

/** Spec 022 v6 — workspace context injection markers. These are *not*
 *  state events; they ride as content fields on regular m.room.message
 *  events so Agents read the body as-is (zero protocol changes) and
 *  the UI uses the marker to fold/hide the auto-injected payload. */
export const AGENTTEAMS_WORKSPACE = {
  /** Tag on a user message whose body had a `<workspace_context>`
   *  block prepended. UI strips the block before rendering. */
  INJECTED: "com.agentteams.workspace.injected",
  /** Tag on a reactive file-content message the renderer emits when
   *  somebody mentions a path. UI folds these into a small card and
   *  the detector skips them to avoid infinite loops. */
  PROJECTION: "com.agentteams.workspace.projection",
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

// ---- Spec 022 v6: workspace context injection ----
//
// No room state events are emitted for workspace bindings: the
// binding is App-local (lives in `~/.agentteams/workspaces.json`)
// and other devices/sessions infer it from the per-message
// `com.agentteams.workspace.injected` content marker.
//
// The two markers (INJECTED, PROJECTION) are declared above on the
// `AGENTTEAMS_WORKSPACE` constant — they're plain content fields on
// regular `m.room.message` events so Agents don't need a schema or
// parser at all (they just read the body).
