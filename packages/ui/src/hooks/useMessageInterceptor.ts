import { useCallback } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  getClient,
  sendReply,
  sendTextMessage,
} from "@magic/matrix-client";
import type {
  WorkspaceBinding,
  WorkspaceFileEntry,
  WorkspaceReadResult,
} from "@magic/shared-types";
import { isElectron } from "./useElectronAPI.js";

/**
 * Spec 022 v3 §5.2.1 — message-send interceptor.
 *
 * The crux of the v3 design: when the user sends a message in a
 * room with a bound workspace, we (a) scan the text for path-like
 * tokens, (b) merge with any explicit picks from the 📁 button,
 * (c) read those files via main-process IPC, (d) split into inline
 * code blocks (small text) vs Matrix media uploads (everything
 * else), and (e) ship the resulting Matrix-native messages. Agents
 * just see normal m.text / m.file / m.image events — no custom
 * protocol required.
 */

interface SendOptions {
  roomId: string;
  /** Final body text — mentions already resolved to placeholders by
   *  the caller. Workspace code blocks are appended on top of this
   *  before send. */
  text: string;
  /** Paths the user picked through the 📁 picker (relative to the
   *  binding root). Always attached even if not mentioned in `text`,
   *  and not subject to the autoAttach toggle. */
  explicitAttachments?: string[];
  /** Reply context — produces an `m.relates_to.m.in_reply_to` field
   *  on the outgoing event. */
  replyToEventId?: string;
  /** When the caller already produced a mention-aware HTML body via
   *  parseMentions(), pass it here. We splice it onto the event
   *  content alongside the augmented plain body so Matrix clients
   *  with mention rendering still see the pills. The Agent reads
   *  `body`, which carries the inlined code blocks. */
  formattedBody?: string;
  mentions?: { user_ids?: string[]; room?: boolean };
}

interface AttachmentRecord {
  path: string;
  ok: boolean;
  contentBase64?: string;
  encoding?: "utf-8" | "base64";
  size?: number;
  mtime?: number;
  isText?: boolean;
  error?: string;
}

// matrix-js-sdk's typed event maps don't know about arbitrary content
// shapes, so widen here for the custom `com.magic.workspace.attached`
// field we tag on outgoing m.text. Same pattern as
// custom-events.ts in matrix-client.
type AnyClient = MatrixClient & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendEvent(roomId: string, eventType: string, content: any): Promise<{ event_id?: string }>;
};

const SMALL_TEXT_THRESHOLD = 50 * 1024; // §3.3 — inline ≤ 50 KB
const MAX_ATTACHMENTS = 5; // §4.3
const MAX_TOTAL_SIZE = 1 * 1024 * 1024; // §4.3
const PER_FILE_HARD_CAP = 5 * 1024 * 1024; // §4.2

export function useMessageInterceptor() {
  const sendWithWorkspace = useCallback(
    async ({
      roomId,
      text,
      explicitAttachments = [],
      replyToEventId,
      formattedBody,
      mentions,
    }: SendOptions): Promise<string> => {
      // No workspace attachments → fall back to the dedicated
      // matrix-client helpers. Keeps the test mocks happy and avoids
      // calling getClient() until we actually need the SDK
      // (it throws when no session is loaded — easy to trip in tests).
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
          "m.room.message",
          content,
        );
        return (result as { event_id?: string }).event_id ?? "";
      };

      if (!isElectron()) return sendPlain(text);

      const api = window.electronAPI?.workspace;
      if (!api) return sendPlain(text);

      const binding: WorkspaceBinding | null = await api.getBinding(roomId);
      if (!binding) return sendPlain(text);

      const fileTree: WorkspaceFileEntry[] = await api.getFileTree(roomId);

      // Spec §3.6 — auto-detect only when the toggle is on. Explicit
      // picks always go through.
      const detectedPaths = binding.autoAttach
        ? detectFilePaths(text, fileTree)
        : [];
      const allPaths = Array.from(
        new Set([...detectedPaths, ...explicitAttachments]),
      );
      const limited = limitAttachments(
        allPaths,
        fileTree,
        MAX_ATTACHMENTS,
        MAX_TOTAL_SIZE,
      );

      if (limited.length === 0) return sendPlain(text);

      // From here on we actually need the SDK client.
      const client = getClient() as unknown as AnyClient;

      // Read every selected file in parallel; bail-fail per file
      // (skip-with-error) so one unreadable path doesn't take down
      // the whole send.
      const reads = await Promise.all(
        limited.map(async (relPath): Promise<AttachmentRecord> => {
          const result: WorkspaceReadResult = await api.readFile(
            roomId,
            relPath,
          );
          return { path: relPath, ...result };
        }),
      );
      const validAttachments = reads.filter((a) => a.ok);

      // Spec §3.3 / §3.5 — small text rides inline (LLM sees code
      // immediately); everything else (large text, binary, images)
      // goes through Matrix media upload as a separate event.
      const inlineable = validAttachments.filter(
        (a) => a.isText && (a.size ?? 0) <= SMALL_TEXT_THRESHOLD,
      );
      const standalone = validAttachments.filter(
        (a) => !(a.isText && (a.size ?? 0) <= SMALL_TEXT_THRESHOLD),
      );

      // Build the user-facing main message. The visible separator
      // line is intentional — it's a clear boundary the LLM can use
      // to tell its eyes apart from the user's original prompt.
      let mainBody = text;
      if (inlineable.length > 0) {
        mainBody += "\n\n────────";
        for (const att of inlineable) {
          const lang = guessLanguage(att.path);
          const decoded = base64ToUtf8(att.contentBase64 ?? "");
          mainBody += `\n\n📎 \`${att.path}\`\n\`\`\`${lang}\n${decoded}\n\`\`\``;
        }
      }

      const eventContent: Record<string, unknown> = {
        msgtype: "m.text",
        body: mainBody,
      };
      // Mentions / reply / formatted_body — splice in here so the
      // augmented body still pings the right people and threads
      // the right reply. Note we *don't* re-inline the workspace
      // code blocks into formatted_body: the HTML version stays as
      // the caller authored it (mentions only), Agents read `body`.
      if (formattedBody) {
        eventContent.format = "org.matrix.custom.html";
        eventContent.formatted_body = formattedBody;
      }
      if (mentions) eventContent["m.mentions"] = mentions;
      if (replyToEventId) {
        eventContent["m.relates_to"] = {
          "m.in_reply_to": { event_id: replyToEventId },
        };
      }
      if (inlineable.length > 0 || standalone.length > 0) {
        // Tag for MessageBubble so the human view shows compact
        // chips instead of the raw inlined code blocks.
        eventContent["com.magic.workspace.attached"] = {
          workspaceName: binding.displayName,
          files: [...inlineable, ...standalone].map((a) => ({
            path: a.path,
            size: a.size ?? 0,
            inlined: inlineable.includes(a),
          })),
        };
      }

      const result = await client.sendEvent(
        roomId,
        "m.room.message",
        eventContent,
      );

      // Spec §3.5 — large / binary files: upload to media repo +
      // post a separate m.file (or m.image for images).
      for (const att of standalone) {
        try {
          const bytes = base64ToUint8(att.contentBase64 ?? "");
          const filename = att.path.split("/").pop() ?? "file";
          const mimeType = att.isText
            ? "text/plain"
            : guessMimeType(att.path);
          const blob = new Blob([bytes.buffer as ArrayBuffer], {
            type: mimeType,
          });
          const upload = await client.uploadContent(blob, {
            type: mimeType,
            name: filename,
          });
          await client.sendEvent(roomId, "m.room.message", {
            msgtype: mimeType.startsWith("image/") ? "m.image" : "m.file",
            body: filename,
            info: {
              size: att.size,
              mimetype: mimeType,
            },
            url: (upload as { content_uri: string }).content_uri,
            "com.magic.workspace.attachment": {
              originalPath: att.path,
              fromWorkspace: binding.displayName,
            },
          });
        } catch (err) {
          console.error(
            `[interceptor] standalone attach failed for ${att.path}:`,
            err,
          );
        }
      }

      return (result as { event_id?: string }).event_id ?? "";
    },
    [],
  );

  return { sendWithWorkspace };
}

/* -------------------- file-path detection -------------------- */

/** Spec §4 — extract workspace file references from a free-form text.
 *  Four strategies, applied in order; results merged into a Set so
 *  one path matched by multiple strategies only attaches once. */
export function detectFilePaths(
  text: string,
  fileTree: WorkspaceFileEntry[],
): string[] {
  if (fileTree.length === 0) return [];
  const paths = new Set<string>();
  const treePathSet = new Set(fileTree.map((f) => f.path));
  const fileNameToPaths = new Map<string, string[]>();
  for (const f of fileTree) {
    const baseName = f.path.split("/").pop() ?? "";
    if (!baseName) continue;
    const list = fileNameToPaths.get(baseName);
    if (list) list.push(f.path);
    else fileNameToPaths.set(baseName, [f.path]);
  }

  // §4.1.1 — backtick-quoted paths.
  const backtickRegex = /`([^`\n]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = backtickRegex.exec(text)) !== null) {
    const candidate = match[1].trim();
    if (treePathSet.has(candidate)) {
      paths.add(candidate);
      continue;
    }
    const matches = fileNameToPaths.get(candidate);
    if (matches && matches.length === 1) {
      paths.add(matches[0]);
    }
  }

  // §4.1.2 — explicit @file:path syntax for power users.
  const atFileRegex = /@file:([^\s]+)/g;
  while ((match = atFileRegex.exec(text)) !== null) {
    const candidate = stripPunctuation(match[1].trim());
    if (treePathSet.has(candidate)) paths.add(candidate);
  }

  // §4.1.3 / §4.1.4 — token-level scan.
  const tokens = text.split(/[\s，。！？,!?]+/);
  const COMMON_ROOT_FILES = new Set([
    "README.md",
    "README",
    "package.json",
    "Cargo.toml",
    "go.mod",
    "pom.xml",
    "Makefile",
    "Dockerfile",
  ]);
  for (const tok of tokens) {
    const cleaned = stripPunctuation(tok);
    if (!cleaned) continue;
    if (cleaned.includes("/") && treePathSet.has(cleaned)) {
      paths.add(cleaned);
      continue;
    }
    // §4.1.4 — bare filename: only attach when unambiguous.
    const matches = fileNameToPaths.get(cleaned);
    if (matches && matches.length === 1) {
      paths.add(matches[0]);
      continue;
    }
    if (COMMON_ROOT_FILES.has(cleaned) && treePathSet.has(cleaned)) {
      paths.add(cleaned);
    }
  }

  return Array.from(paths);
}

/** Trim CJK / ASCII trailing/leading punctuation that sticks to file
 *  paths in natural-language sentences (e.g. `src/main.py，` or
 *  `（package.json）`). */
function stripPunctuation(raw: string): string {
  return raw
    .replace(/[.,;:!?，。；：！？)】」』"']+$/u, "")
    .replace(/^[(【「『"']+/u, "");
}

/** Spec §4.3 — cap auto/explicit picks at maxCount files + maxTotalSize
 *  bytes. Files over the per-file cap are skipped silently here; the
 *  composer surfaces a hint above maxCount. */
function limitAttachments(
  paths: string[],
  tree: WorkspaceFileEntry[],
  maxCount: number,
  maxTotalSize: number,
): string[] {
  const treeMap = new Map(tree.map((f) => [f.path, f]));
  const result: string[] = [];
  let totalSize = 0;
  for (const p of paths) {
    if (result.length >= maxCount) break;
    const entry = treeMap.get(p);
    if (!entry) continue;
    if (entry.size > PER_FILE_HARD_CAP) continue;
    if (totalSize + entry.size > maxTotalSize) break;
    result.push(p);
    totalSize += entry.size;
  }
  return result;
}

/* -------------------- helpers -------------------- */

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64ToUtf8(b64: string): string {
  const bytes = base64ToUint8(b64);
  return new TextDecoder("utf-8").decode(bytes);
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
