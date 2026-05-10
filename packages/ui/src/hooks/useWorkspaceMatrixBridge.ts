import { useEffect } from "react";
import type { MatrixEvent, Room } from "matrix-js-sdk";
import { RoomEvent } from "matrix-js-sdk";
import type { MatrixClient } from "matrix-js-sdk";
import {
  getClient,
  hasClient,
  useAuthStore,
} from "@magic/matrix-client";
import {
  MAGIC_EVENTS,
  type WorkspaceFileEntry,
  type WorkspaceReadResult,
} from "@magic/shared-types";
import { isElectron } from "./useElectronAPI.js";

// matrix-js-sdk's typed event maps (StateEvents / TimelineEvents) only
// know about the canonical room-event types. Custom `com.magic.*`
// events have to ride through this widened shape — the SDK accepts
// arbitrary type strings at runtime, the type system just doesn't.
// Same pattern used in matrix-client/src/custom-events.ts.
type AnyClient = MatrixClient & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendEvent(roomId: string, eventType: string, content: any): Promise<{ event_id?: string }>;
  sendStateEvent(
    roomId: string,
    eventType: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any,
    stateKey?: string,
  ): Promise<{ event_id?: string }>;
};

/**
 * Spec 022 § 5.2.1 — App-level bridge between the Electron main
 * process and the Matrix protocol. Mounted once at the App root.
 *
 * Outbound (main → Matrix):
 *   - When the watcher republishes a file tree, post a
 *     `com.magic.workspace.binding` state event so any Agent in the
 *     room can see the available files. Trees over the inline cap
 *     spill into `tree_chunk` message events with the state event
 *     pointing at them by event id.
 *
 * Inbound (Matrix → main → Matrix):
 *   - Live `read_request` / `list_request` events from other room
 *     members (Agents) trigger an IPC into WorkspaceManager, then we
 *     emit the matching response event. Backfilled (paginated)
 *     requests are ignored — replaying old asks would race the
 *     pending Futures the Agent already cleaned up.
 */
const INLINE_TREE_LIMIT = 500;
const TREE_CHUNK_SIZE = 200;
// Matrix message events should stay well under the homeserver's
// payload ceiling. Anything bigger goes through the media repo.
const INLINE_FILE_THRESHOLD = 32 * 1024;

export function useWorkspaceMatrixBridge(): void {
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (!isElectron()) return;
    const api = window.electronAPI.workspace;
    if (!api || !userId || !hasClient()) return;

    const client = getClient() as unknown as AnyClient;

    // ---- Outbound: file tree changes → state event ----------------
    const unsubFileTree = api.onFileTreeChanged(async ({ roomId, files }) => {
      const me = client.getUserId();
      if (!me) return;
      try {
        if (files.length === 0) {
          // Unbind: clear the state event the binder posted earlier.
          await client.sendStateEvent(
            roomId,
            MAGIC_EVENTS.WORKSPACE_BINDING,
            { bound: false },
            me,
          );
          return;
        }

        const binding = await api.getBinding(roomId);
        const totalSize = files.reduce(
          (acc: number, f: WorkspaceFileEntry) => acc + f.size,
          0,
        );

        if (files.length <= INLINE_TREE_LIMIT) {
          await client.sendStateEvent(
            roomId,
            MAGIC_EVENTS.WORKSPACE_BINDING,
            {
              bound: true,
              displayName: binding?.displayName ?? "",
              boundBy: me,
              boundAt: binding?.boundAt ?? Date.now(),
              fileCount: files.length,
              totalSize,
              tree: files,
              treeChunked: false,
            },
            me,
          );
        } else {
          // Spec § 3.1 — large repos: chunk the manifest into message
          // events, then point the state event at the chunk eventIds.
          const chunkEventIds: string[] = [];
          const totalChunks = Math.ceil(files.length / TREE_CHUNK_SIZE);
          for (let i = 0; i < files.length; i += TREE_CHUNK_SIZE) {
            const chunk = files.slice(i, i + TREE_CHUNK_SIZE);
            const result = await client.sendEvent(
              roomId,
              MAGIC_EVENTS.WORKSPACE_TREE_CHUNK,
              {
                chunkIndex: Math.floor(i / TREE_CHUNK_SIZE),
                totalChunks,
                files: chunk,
              },
            );
            const eventId = (result as { event_id?: string }).event_id;
            if (eventId) chunkEventIds.push(eventId);
          }
          await client.sendStateEvent(
            roomId,
            MAGIC_EVENTS.WORKSPACE_BINDING,
            {
              bound: true,
              displayName: binding?.displayName ?? "",
              boundBy: me,
              boundAt: binding?.boundAt ?? Date.now(),
              fileCount: files.length,
              totalSize,
              tree: null,
              treeChunked: true,
              treeChunks: chunkEventIds.length,
              treeManifestEventIds: chunkEventIds,
            },
            me,
          );
        }
      } catch (err) {
        console.error("[workspace] publish binding failed:", err);
      }
    });

    // ---- Inbound: read/list requests → main process → response ----
    const handleTimeline = async (
      event: MatrixEvent,
      room: Room | undefined,
      toStartOfTimeline: boolean | undefined,
    ) => {
      if (!room || toStartOfTimeline) return;
      const me = client.getUserId();
      if (!me) return;
      const senderId = event.getSender();
      if (!senderId || senderId === me) return;

      const eventType = event.getType();
      const roomId = event.getRoomId();
      if (!roomId) return;

      if (eventType === MAGIC_EVENTS.WORKSPACE_READ_REQUEST) {
        await handleReadRequest(event, roomId, senderId, me);
      } else if (eventType === MAGIC_EVENTS.WORKSPACE_LIST_REQUEST) {
        await handleListRequest(event, roomId, senderId, me);
      }
    };

    const handleReadRequest = async (
      event: MatrixEvent,
      roomId: string,
      senderId: string,
      me: string,
    ) => {
      const content = event.getContent() as {
        request_id?: string;
        path?: string;
        max_size?: number;
        binding_owner?: string;
      };
      if (!content.request_id || !content.path) return;
      // When multiple users have bound the same room each runs their
      // own bridge. `binding_owner` lets the Agent direct the request
      // at one of them; if it's set and not us, stay quiet.
      if (content.binding_owner && content.binding_owner !== me) return;

      const binding = await api.getBinding(roomId);
      // Don't respond on behalf of someone else's binding even if our
      // own client happens to be online — only the binder owns the
      // file system.
      if (!binding || binding.boundBy !== me) return;

      const result: WorkspaceReadResult = await api.readFile(
        roomId,
        content.path,
        content.max_size ?? 1024 * 1024,
        senderId,
      );

      const response: Record<string, unknown> = {
        request_id: content.request_id,
        path: content.path,
        ok: result.ok,
        "m.relates_to": {
          rel_type: "m.reference",
          event_id: event.getId(),
        },
      };

      if (!result.ok) {
        response.error = result.error;
        response.errorMessage = result.errorMessage;
      } else if (result.contentBase64 !== undefined) {
        const bytes = base64ToUint8(result.contentBase64);
        const mimeType = guessMimeType(content.path, result.encoding);
        if (bytes.byteLength > INLINE_FILE_THRESHOLD) {
          // Spec § 3.2 — large file: hand it to the homeserver's media
          // repo so the Agent can fetch through the standard route.
          // E2EE rooms still encrypt the message event that carries the
          // mxc URL; the media itself rides Matrix's standard plaintext
          // path (which is acceptable here because the URL is gated by
          // the access token).
          // Cast through ArrayBuffer to dodge the SharedArrayBuffer
          // overload the lib.dom Blob ctor would otherwise accept.
          const blob = new Blob([bytes.buffer as ArrayBuffer], {
            type: mimeType,
          });
          const upload = await client.uploadContent(blob, {
            name: content.path.split("/").pop() ?? "file",
            type: mimeType,
          });
          response.via_media = true;
          response.mxc_url = (upload as { content_uri: string }).content_uri;
          response.mime_type = mimeType;
          response.size = result.size;
          response.encoding = result.encoding;
          response.mtime = result.mtime;
        } else {
          response.via_media = false;
          response.size = result.size;
          response.encoding = result.encoding;
          response.mtime = result.mtime;
          if (result.encoding === "utf-8") {
            response.content = new TextDecoder("utf-8").decode(bytes);
          } else {
            // Already base64 from the main process — re-use directly
            // so we don't lose precision through a UTF-8 round-trip.
            response.content = result.contentBase64;
          }
        }
      }

      try {
        await client.sendEvent(
          roomId,
          MAGIC_EVENTS.WORKSPACE_READ_RESPONSE,
          response,
        );
      } catch (err) {
        console.error("[workspace] send read_response failed:", err);
      }
    };

    const handleListRequest = async (
      event: MatrixEvent,
      roomId: string,
      senderId: string,
      me: string,
    ) => {
      const content = event.getContent() as {
        request_id?: string;
        path?: string;
        depth?: number;
        binding_owner?: string;
      };
      if (!content.request_id) return;
      if (content.binding_owner && content.binding_owner !== me) return;

      const binding = await api.getBinding(roomId);
      if (!binding || binding.boundBy !== me) return;

      const result = await api.listDir(
        roomId,
        content.path ?? "",
        content.depth ?? 1,
        senderId,
      );

      try {
        await client.sendEvent(
          roomId,
          MAGIC_EVENTS.WORKSPACE_LIST_RESPONSE,
          {
            request_id: content.request_id,
            path: content.path ?? "",
            ok: result.ok,
            entries: result.entries,
            error: result.error,
            errorMessage: result.errorMessage,
            "m.relates_to": {
              rel_type: "m.reference",
              event_id: event.getId(),
            },
          },
        );
      } catch (err) {
        console.error("[workspace] send list_response failed:", err);
      }
    };

    client.on(RoomEvent.Timeline, handleTimeline);

    return () => {
      unsubFileTree?.();
      client.off(RoomEvent.Timeline, handleTimeline);
    };
  }, [userId]);
}

/** Fast base64 → Uint8Array without going through atob's UTF-16 hop
 *  for non-ASCII bytes. Used for both inline UTF-8 decode and Blob
 *  construction for media uploads. */
function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Minimal extension → MIME table. The Agent only really cares about
 *  text vs binary; everything past that is best-effort. */
function guessMimeType(
  filePath: string,
  encoding: "utf-8" | "base64" | undefined,
): string {
  const ext = filePath.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "md":
      return "text/markdown";
    case "json":
      return "application/json";
    case "html":
    case "htm":
      return "text/html";
    case "css":
      return "text/css";
    case "js":
    case "mjs":
      return "application/javascript";
    case "ts":
    case "tsx":
      return "application/typescript";
    case "py":
      return "text/x-python";
    case "go":
      return "text/x-go";
    case "rs":
      return "text/x-rust";
    case "yaml":
    case "yml":
      return "text/yaml";
    case "xml":
      return "text/xml";
    case "csv":
      return "text/csv";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "pdf":
      return "application/pdf";
    default:
      return encoding === "utf-8" ? "text/plain" : "application/octet-stream";
  }
}
