import { useCallback, useEffect, useRef } from "react";
import {
  EventType,
  RoomEvent,
  type MatrixClient,
  type MatrixEvent,
} from "matrix-js-sdk";
import {
  getClient,
  hasClient,
  sendReply,
  sendTextMessage,
  useAuthStore,
  useSessionStore,
} from "@magic/matrix-client";
import {
  AGENTTEAMS_WORKSPACE,
  type WorkspaceFileNode,
  type WorkspaceChangePayload,
} from "@magic/shared-types";
import { isElectron } from "./useElectronAPI.js";

/**
 * Spec 022 v6 §6.2 — workspace context injection.
 *
 * Two coordinated jobs in one hook so the renderer has a single owner
 * of the workspace ↔ Matrix bridge:
 *
 *   A. sendWithContext (called by useComposer): for every user message
 *      in a bound room, prepend a `<workspace_context>` block to the
 *      body holding the live dir tree, the global agentteams.md, and
 *      the per-binding context. The Agent reads body as-is and sees the
 *      "system prompt" naturally; the UI strips the block before
 *      rendering so users only see their own text.
 *
 *   B. timeline listener: when *any* message in a bound room mentions
 *      a workspace path (user or Agent), shoot back an m.notice with
 *      the file's contents. Self-tagged with PROJECTION so we don't
 *      loop on our own output, and per-(roomId,path,mtime) deduped so
 *      a chat that re-references a file ten times only ships the
 *      bytes once.
 *
 * Falls back to plain sendTextMessage/sendReply on the web build (no
 * electronAPI) and on bound-only-on-another-device rooms.
 */

const CTX_OPEN = "<workspace_context";
const CTX_CLOSE = "</workspace_context>";
const MAX_FILES_PER_MESSAGE = 3;
const INLINE_SIZE_THRESHOLD = 50 * 1024;

interface SendOptions {
  roomId: string;
  text: string;
  replyToEventId?: string;
  formattedBody?: string;
  mentions?: { user_ids?: string[]; room?: boolean };
}

// matrix-js-sdk's typed event map doesn't know our custom content
// markers, so we widen for the .sendEvent / .uploadContent call.
type AnyClient = MatrixClient & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendEvent(roomId: string, eventType: string, content: any): Promise<{ event_id?: string }>;
};

export function useWorkspaceInjection() {
  // Per-room dedupe map: `{ roomId → { relPath → mtime } }`. Same
  // (path, mtime) → skip; bumped mtime → re-project.
  const projected = useRef<Map<string, Map<string, number>>>(new Map());

  // ===== A. sendWithContext =====

  const sendWithContext = useCallback(
    async ({
      roomId,
      text,
      replyToEventId,
      formattedBody,
      mentions,
    }: SendOptions): Promise<string> => {
      // Plain-text fast path for any case where injection doesn't apply.
      const sendPlain = async (body: string): Promise<string> => {
        if (replyToEventId && !formattedBody && !mentions) {
          return sendReply(roomId, body, replyToEventId);
        }
        if (!replyToEventId && !formattedBody && !mentions) {
          return sendTextMessage(roomId, body);
        }
        const content: Record<string, unknown> = {
          msgtype: "m.text",
          body,
        };
        if (formattedBody) {
          content.format = "org.matrix.custom.html";
          content.formatted_body = formattedBody;
        }
        if (mentions) content["m.mentions"] = mentions;
        if (replyToEventId) {
          content["m.relates_to"] = {
            "m.in_reply_to": { event_id: replyToEventId },
          };
        }
        const c = getClient() as unknown as AnyClient;
        const result = await c.sendEvent(
          roomId,
          EventType.RoomMessage,
          content,
        );
        return result.event_id ?? "";
      };

      if (!isElectron()) return sendPlain(text);
      const api = window.electronAPI?.workspace;
      if (!api) return sendPlain(text);

      const binding = await api.getBinding(roomId);
      if (!binding) return sendPlain(text);

      // Live tree + system context. Both come from the same Main-process
      // source-of-truth (chokidar invalidates the 5s tree cache, the
      // context call hits disk every time).
      const [{ nodes, truncated }, { global, binding: bindingCtx }] =
        await Promise.all([
          api.scanTree(roomId),
          api.getSystemContext(roomId),
        ]);

      const ctxBlock = buildContextBlock({
        workspaceName: binding.displayName,
        nodes,
        truncated,
        global,
        bindingCtx,
      });
      const fullBody = `${ctxBlock}\n\n${text}`;

      const content: Record<string, unknown> = {
        msgtype: "m.text",
        body: fullBody,
        [AGENTTEAMS_WORKSPACE.INJECTED]: {
          workspace: binding.displayName,
          // Length in chars — MessageBubble strips the block via marker
          // detection so the number is informational only.
          contextLength: ctxBlock.length,
        },
      };
      if (formattedBody) {
        // The HTML body is the user-typed text only; the workspace
        // context block is plain-text and only meant for the Agent
        // reading `body`.
        content.format = "org.matrix.custom.html";
        content.formatted_body = formattedBody;
      }
      if (mentions) content["m.mentions"] = mentions;
      if (replyToEventId) {
        content["m.relates_to"] = {
          "m.in_reply_to": { event_id: replyToEventId },
        };
      }

      const c = getClient() as unknown as AnyClient;
      const result = await c.sendEvent(
        roomId,
        EventType.RoomMessage,
        content,
      );
      return result.event_id ?? "";
    },
    [],
  );

  // ===== B. Reactive file projection on path mention =====

  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (!isElectron()) return;
    if (!hasClient()) return;
    const api = window.electronAPI?.workspace;
    if (!api) return;

    const client = getClient();

    // Workspace lifecycle → housekeeping. The only one we actively
    // care about here is `unbind` so the dedupe map doesn't keep
    // growing forever (and so a fresh re-bind reprojects).
    const onChange = (payload: WorkspaceChangePayload): void => {
      if (payload.kind === "unbind") {
        projected.current.delete(payload.roomId);
      }
    };
    const unsubChange = api.onChange(onChange);

    const onTimeline = (
      event: MatrixEvent,
      _room: unknown,
      toStartOfTimeline?: boolean,
      _removed?: boolean,
      data?: { liveEvent?: boolean },
    ): void => {
      // Back-paginated history → skip. Only react to live events.
      if (toStartOfTimeline) return;
      if (data && data.liveEvent === false) return;
      if (event.getType() !== EventType.RoomMessage) return;

      // The handler is async but the SDK doesn't await it; wrap so
      // any thrown promise rejection surfaces in the console rather
      // than as an UnhandledPromiseRejection.
      void handleTimelineEvent(event, projected.current).catch((err) => {
        console.error("[workspace] projection failed:", err);
      });
    };

    client.on(RoomEvent.Timeline, onTimeline);
    return () => {
      unsubChange();
      client.off(RoomEvent.Timeline, onTimeline);
    };
    // Re-attach when the active session changes — the SDK client
    // identity flips with it, and an old client's listener can't see
    // the new client's events.
  }, [activeSessionId, userId]);

  return { sendWithContext };
}

// ===== Timeline handler (extracted so the effect body stays readable) =====

async function handleTimelineEvent(
  event: MatrixEvent,
  projected: Map<string, Map<string, number>>,
): Promise<void> {
  const content = event.getContent() as Record<string, unknown> | undefined;
  if (!content) return;
  // ⭐ Loop prevention — never re-project a projection message.
  if (content[AGENTTEAMS_WORKSPACE.PROJECTION]) return;

  const roomId = event.getRoomId();
  if (!roomId) return;

  const api = window.electronAPI?.workspace;
  if (!api) return;

  const binding = await api.getBinding(roomId);
  if (!binding) return;

  // Only the user who bound the folder projects its files. Two users
  // both bound to different paths in the same room would otherwise
  // race each other.
  const ownUserId = useAuthStore.getState().userId;
  if (!ownUserId || binding.boundBy !== ownUserId) return;

  const body = typeof content.body === "string" ? content.body : "";
  if (!body) return;

  // Strip the auto-injected context block before scanning so paths
  // listed inside the tree dump don't trigger projection.
  const userText = stripWorkspaceContext(body);
  if (!userText) return;

  const { nodes } = await api.scanTree(roomId);
  const filePaths = nodes
    .filter((n) => !n.isDirectory)
    .map((n) => n.path);
  const detected = detectFilePaths(userText, filePaths).slice(
    0,
    MAX_FILES_PER_MESSAGE,
  );
  if (detected.length === 0) return;

  let roomMap = projected.get(roomId);
  if (!roomMap) {
    roomMap = new Map();
    projected.set(roomId, roomMap);
  }

  const client = getClient() as unknown as AnyClient;

  for (const relPath of detected) {
    const result = await api.readFile(roomId, relPath);
    if (!result.ok) {
      // ⭐ m.text, not m.notice. Same reasoning as the inline branch
      // below; here we additionally need the Agent to know "I tried
      // to fetch X and it wasn't readable" so it can adapt.
      await client.sendEvent(roomId, EventType.RoomMessage, {
        msgtype: "m.text",
        body:
          `[工作区文件读取失败 · 系统消息] 路径 \`${relPath}\` 无法读取：` +
          `${result.error ?? "未知错误"}。\n` +
          `不要再次请求该文件，请基于已知信息继续回答。`,
        [AGENTTEAMS_WORKSPACE.PROJECTION]: {
          kind: "file_error",
          path: relPath,
        },
      });
      continue;
    }
    if (roomMap.get(relPath) === result.mtime) continue; // already projected at this mtime
    roomMap.set(relPath, result.mtime ?? 0);

    if (
      result.isText &&
      (result.size ?? 0) <= INLINE_SIZE_THRESHOLD &&
      typeof result.content === "string"
    ) {
      // ⭐ m.text (not m.notice). Matrix convention has bots / Agents
      // skip m.notice to avoid bot-to-bot loops — using it here would
      // silently break Spec §1's "Agent zero modifications" promise
      // (the Agent would never read the file content). Loop prevention
      // lives in the PROJECTION content marker, not in the msgtype.
      //
      // The body is heavily prompt-engineered so an Agent reading raw
      // chat history reliably interprets it as "this IS the file
      // content I asked for" rather than as a preview / hint / system
      // chatter to be ignored. See `buildProjectionBody`.
      await client.sendEvent(roomId, EventType.RoomMessage, {
        msgtype: "m.text",
        body: buildProjectionBody(relPath, result.content, result.size ?? 0),
        [AGENTTEAMS_WORKSPACE.PROJECTION]: {
          kind: "file",
          path: relPath,
          size: result.size ?? 0,
          mtime: result.mtime ?? 0,
        },
      });
    } else {
      // Large or binary → upload + post m.file. Body still carries the
      // path label so the Agent sees "I have access to this file".
      try {
        const bytes =
          result.isText && typeof result.content === "string"
            ? new TextEncoder().encode(result.content)
            : base64ToUint8(result.base64 ?? "");
        const filename = relPath.split("/").pop() ?? "file";
        const mimeType = result.isText
          ? "text/plain"
          : guessMimeType(relPath);
        const blob = new Blob([bytes.buffer as ArrayBuffer], {
          type: mimeType,
        });
        const upload = (await client.uploadContent(blob, {
          type: mimeType,
          name: filename,
        })) as { content_uri: string };
        await client.sendEvent(roomId, EventType.RoomMessage, {
          msgtype: "m.file",
          body: filename,
          info: { size: result.size ?? 0, mimetype: mimeType },
          url: upload.content_uri,
          [AGENTTEAMS_WORKSPACE.PROJECTION]: {
            kind: "file",
            path: relPath,
            size: result.size ?? 0,
            mtime: result.mtime ?? 0,
          },
        });
      } catch (err) {
        console.error(
          `[workspace] standalone projection upload failed for ${relPath}:`,
          err,
        );
      }
    }
  }
}

// ===== Helpers =====

/** Strip the `<workspace_context ...>...</workspace_context>` block
 *  from a body so downstream renderers / detectors see only the user-
 *  authored portion. Exported for MessageBubble. */
export function stripWorkspaceContext(body: string): string {
  const open = body.indexOf(CTX_OPEN);
  if (open === -1) return body;
  const close = body.indexOf(CTX_CLOSE, open);
  if (close === -1) return body;
  const head = body.slice(0, open);
  const tail = body.slice(close + CTX_CLOSE.length);
  return `${head}${tail}`.trim();
}

interface BuildBlockArgs {
  workspaceName: string;
  nodes: WorkspaceFileNode[];
  truncated: boolean;
  global: string | null;
  bindingCtx: string | null;
}

function buildContextBlock({
  workspaceName,
  nodes,
  truncated,
  global,
  bindingCtx,
}: BuildBlockArgs): string {
  const tree = renderTree(nodes);
  let block = `${CTX_OPEN} name="${escapeAttr(workspaceName)}">\n## 目录结构\n${tree}`;
  if (truncated) {
    block += `\n（目录较大，仅列出前 ${nodes.length} 项）`;
  }
  if (global) block += `\n\n## 全局说明\n${global}`;
  if (bindingCtx) block += `\n\n## 项目说明\n${bindingCtx}`;
  block +=
    `\n\n## 文件内容获取机制（重要）\n` +
    `- 当你或用户在消息中提到本工作区内的某个文件路径（如 \`${exampleFile(nodes)}\`），` +
    `**系统会在聊天历史中自动追加一条以「📂 [工作区文件 · 自动注入]」开头的消息，body 即为该文件的完整内容**。\n` +
    `- 这条注入消息可能出现在你**当前正在回答的这条用户消息之前**——请向上扫描最近若干条消息查找它。\n` +
    `- 你**不需要**调用任何文件工具、不需要让用户上传、不需要请求路径——直接读那条注入消息的 body 即可。\n` +
    `- 如果向上找不到匹配的注入消息（mtime 未变会去重），说明文件内容已在历史里出现过，请使用之前那次。\n` +
    `- 工作区路径与你本机文件系统的目录**完全无关**，不要尝试用 ls/cat 等工具去访问 \`${workspaceName}\` 的路径。\n` +
    `${CTX_CLOSE}`;
  return block;
}

/** Build the projection body. Heavily prompt-engineered so an Agent
 *  reliably treats it as the canonical file content — not as a
 *  preview, suggestion, or system chatter. */
function buildProjectionBody(
  relPath: string,
  content: string,
  size: number,
): string {
  const lang = guessLanguage(relPath);
  return (
    `📂 [工作区文件 · 自动注入] \`${relPath}\` (${formatBytes(size)})\n` +
    `以下三个反引号之间是该文件的**完整内容**（系统已直接从用户磁盘读取）。` +
    `若用户随后询问这个文件、或你之前提到过这个路径，请直接基于以下内容回答，` +
    `**不要**再要求用户上传或提供路径：\n\n` +
    `\`\`\`${lang}\n${content}\n\`\`\``
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}

function renderTree(nodes: WorkspaceFileNode[]): string {
  return nodes
    .map((n) => {
      const depth = n.path.split("/").length - 1;
      const indent = "  ".repeat(depth);
      const name = n.path.split("/").pop() ?? n.path;
      return n.isDirectory ? `${indent}${name}/` : `${indent}${name}`;
    })
    .join("\n");
}

function exampleFile(nodes: WorkspaceFileNode[]): string {
  const f = nodes.find((n) => !n.isDirectory);
  return f ? f.path : "src/main.py";
}

/** Spec §6.2 detector — backtick paths, @file:path, and token-level
 *  fallback for `/`-bearing paths or known root files. */
export function detectFilePaths(
  text: string,
  treePaths: string[],
): string[] {
  if (treePaths.length === 0) return [];
  const found = new Set<string>();
  const pathSet = new Set(treePaths);

  const nameToPath = new Map<string, string[]>();
  for (const p of treePaths) {
    const base = p.split("/").pop();
    if (!base) continue;
    const list = nameToPath.get(base);
    if (list) list.push(p);
    else nameToPath.set(base, [p]);
  }

  // §6.2-A — backtick-quoted paths.
  const bt = /`([^`\n]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = bt.exec(text))) {
    const candidate = m[1].trim();
    if (pathSet.has(candidate)) {
      found.add(candidate);
      continue;
    }
    const matches = nameToPath.get(candidate);
    if (matches && matches.length === 1) found.add(matches[0]);
  }

  // §6.2-B — @file:path syntax for power users.
  const af = /@file:([^\s]+)/g;
  while ((m = af.exec(text))) {
    const candidate = stripPunctuation(m[1]);
    if (pathSet.has(candidate)) found.add(candidate);
  }

  // §6.2-C — token-level scan: `/`-bearing tokens + unambiguous
  // bare filenames + a small set of root files everyone references
  // by bare name.
  const ROOT_FILES = new Set([
    "README.md",
    "README",
    "package.json",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "Makefile",
    "Dockerfile",
  ]);
  const tokens = text.split(/[\s，。！？,!?、；：]+/);
  for (const tok of tokens) {
    const candidate = stripPunctuation(tok);
    if (!candidate) continue;
    if (candidate.includes("/") && pathSet.has(candidate)) {
      found.add(candidate);
      continue;
    }
    const matches = nameToPath.get(candidate);
    if (matches && matches.length === 1) {
      found.add(matches[0]);
      continue;
    }
    if (ROOT_FILES.has(candidate) && pathSet.has(candidate)) {
      found.add(candidate);
    }
  }
  return Array.from(found);
}

function stripPunctuation(raw: string): string {
  return raw
    .replace(/[.,;:!?，。；：！？)】」』"']+$/u, "")
    .replace(/^[(【「『"']+/u, "");
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function guessLanguage(filepath: string): string {
  const ext = filepath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    py: "python",
    js: "javascript",
    mjs: "javascript",
    ts: "typescript",
    tsx: "tsx",
    jsx: "jsx",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    sh: "bash",
    yaml: "yaml",
    yml: "yaml",
    json: "json",
    md: "markdown",
    html: "html",
    css: "css",
    scss: "scss",
    sql: "sql",
    toml: "toml",
    xml: "xml",
  };
  return map[ext] ?? "";
}

function guessMimeType(filepath: string): string {
  const ext = filepath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    zip: "application/zip",
  };
  return map[ext] ?? "application/octet-stream";
}
