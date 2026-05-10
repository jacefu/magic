import { z } from "zod";

export const MAGIC_EVENTS = {
  AGENT_STATUS: "com.magic.agent.status",
  TASK_ASSIGNMENT: "com.magic.task.assignment",
  SOUL_CONTENT: "com.magic.soul.content",
  MEMORY_CONTENT: "com.magic.memory.content",
  HEARTBEAT: "com.magic.heartbeat",
  // Spec 022 — workspace folder binding (Matrix-only protocol).
  WORKSPACE_BINDING: "com.magic.workspace.binding",
  WORKSPACE_TREE_CHUNK: "com.magic.workspace.tree_chunk",
  WORKSPACE_READ_REQUEST: "com.magic.workspace.read_request",
  WORKSPACE_READ_RESPONSE: "com.magic.workspace.read_response",
  WORKSPACE_LIST_REQUEST: "com.magic.workspace.list_request",
  WORKSPACE_LIST_RESPONSE: "com.magic.workspace.list_response",
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

// ---- Spec 022: workspace folder binding events ----

const WorkspaceFileEntrySchema = z.object({
  path: z.string(),
  size: z.number(),
  mtime: z.number(),
});
export type WorkspaceFileEntrySchema = z.infer<typeof WorkspaceFileEntrySchema>;

/**
 * State event posted by the Magic client when a user binds a folder.
 * `state_key` is the binder's user id so multiple users can bind the
 * same room independently. `tree` is inlined when the file list fits
 * inside Matrix's ~64 KB state event ceiling; otherwise it's null and
 * `treeChunked` flips to true with `treeManifestEventIds` pointing at
 * `WORKSPACE_TREE_CHUNK` message events that carry the manifest.
 */
export const WorkspaceBindingEvent = z.object({
  bound: z.boolean(),
  displayName: z.string().optional(),
  boundBy: z.string().optional(),
  boundAt: z.number().optional(),
  fileCount: z.number().optional(),
  totalSize: z.number().optional(),
  tree: z.array(WorkspaceFileEntrySchema).nullable().optional(),
  treeChunked: z.boolean().optional(),
  treeChunks: z.number().optional(),
  treeManifestEventIds: z.array(z.string()).optional(),
});
export type WorkspaceBindingEvent = z.infer<typeof WorkspaceBindingEvent>;

export const WorkspaceTreeChunkEvent = z.object({
  chunkIndex: z.number(),
  totalChunks: z.number(),
  files: z.array(WorkspaceFileEntrySchema),
});
export type WorkspaceTreeChunkEvent = z.infer<typeof WorkspaceTreeChunkEvent>;

export const WorkspaceReadRequestEvent = z.object({
  request_id: z.string(),
  path: z.string(),
  encoding: z.enum(["utf-8", "base64", "auto"]).optional(),
  max_size: z.number().optional(),
  binding_owner: z.string().optional(),
});
export type WorkspaceReadRequestEvent = z.infer<
  typeof WorkspaceReadRequestEvent
>;

/**
 * Either inline `content` (small files, encoded per `encoding`) or
 * `via_media: true` + `mxc_url` for files over the inline threshold —
 * the renderer uploads to the Matrix media repo so the Agent can
 * fetch via the standard /_matrix/media/v3/download endpoint.
 */
export const WorkspaceReadResponseEvent = z.object({
  request_id: z.string(),
  path: z.string(),
  ok: z.boolean(),
  size: z.number().optional(),
  mtime: z.number().optional(),
  encoding: z.enum(["utf-8", "base64"]).optional(),
  content: z.string().optional(),
  via_media: z.boolean().optional(),
  mxc_url: z.string().optional(),
  mime_type: z.string().optional(),
  error: z.string().optional(),
  errorMessage: z.string().optional(),
});
export type WorkspaceReadResponseEvent = z.infer<
  typeof WorkspaceReadResponseEvent
>;

export const WorkspaceListRequestEvent = z.object({
  request_id: z.string(),
  path: z.string().optional(),
  depth: z.number().optional(),
  binding_owner: z.string().optional(),
});
export type WorkspaceListRequestEvent = z.infer<
  typeof WorkspaceListRequestEvent
>;

export const WorkspaceListResponseEvent = z.object({
  request_id: z.string(),
  path: z.string().optional(),
  ok: z.boolean(),
  entries: z
    .array(
      z.object({
        path: z.string(),
        size: z.number(),
        mtime: z.number(),
        isDirectory: z.boolean(),
      }),
    )
    .optional(),
  error: z.string().optional(),
  errorMessage: z.string().optional(),
});
export type WorkspaceListResponseEvent = z.infer<
  typeof WorkspaceListResponseEvent
>;
