import { useCallback, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  getClient,
  hasClient,
  useAuthStore,
} from "@magic/matrix-client";
import {
  MAGIC_EVENTS,
  type WorkspaceBinding,
  type WorkspaceFileEntry,
  type WorkspaceScanResult,
} from "@magic/shared-types";
import { useWorkspaceBinding } from "../hooks/useWorkspaceBinding.js";
import { BindFolderConfirmDialog } from "./BindFolderConfirmDialog.js";
import { isElectron } from "../hooks/useElectronAPI.js";

interface BindFolderButtonProps {
  roomId: string;
  /** Display label for the room/peer used in the confirm dialog
   *  ("manager 看到清单后…"). Falls back to a generic label if the
   *  caller doesn't know yet. */
  peerLabel?: string;
  /** When true, render only the icon (used inside the composer "+"
   *  menu). When false, render a full pill-shaped button (used inside
   *  WorkspaceSection's empty state). */
  variant?: "menu" | "pill";
  className?: string;
  onAfterBind?: () => void;
}

/**
 * Spec 022 § 4.1 — entry point that orchestrates the three-step bind
 * flow: native picker → folder scan → confirm dialog → publish.
 *
 * State only lives here while the dialog is open; once it closes, the
 * canonical store of truth is the WorkspaceManager (subscribed via
 * useWorkspaceBinding).
 */
export function BindFolderButton({
  roomId,
  peerLabel = "Agent",
  variant = "pill",
  className,
  onAfterBind,
}: BindFolderButtonProps) {
  const { bind } = useWorkspaceBinding(roomId);
  const userId = useAuthStore((s) => s.userId);
  const [pending, setPending] = useState<{
    folderPath: string;
    scan: WorkspaceScanResult;
  } | null>(null);
  const [picking, setPicking] = useState(false);

  const startBindFlow = useCallback(async () => {
    if (!isElectron()) return;
    const api = window.electronAPI.workspace;
    if (!api || picking) return;
    setPicking(true);
    try {
      const folderPath = await api.pickFolder();
      if (!folderPath) return;
      const scan = await api.scanFolder(folderPath);
      setPending({ folderPath, scan });
    } catch (err) {
      console.error("[workspace] pick/scan failed:", err);
    } finally {
      setPicking(false);
    }
  }, [picking]);

  const handleConfirm = useCallback(async () => {
    if (!pending) return;
    const result = await bind(pending.folderPath);
    // Spec §5.2.3 — fire the bind announcement message + state event
    // *after* the main-process binding succeeds, so any error during
    // local registration prevents a misleading "bound" message in the
    // room. Failures in the announce path don't unwind the bind —
    // they're visible to the user as a missing chat message and
    // logged for debugging.
    if (hasClient() && userId) {
      try {
        await sendBindAnnouncement(
          getClient(),
          roomId,
          userId,
          result.binding,
          result.files,
        );
      } catch (err) {
        console.error("[workspace] bind announcement failed:", err);
      }
    }
    setPending(null);
    onAfterBind?.();
  }, [bind, pending, onAfterBind, roomId, userId]);

  return (
    <>
      {variant === "menu" ? (
        <button
          type="button"
          onClick={startBindFlow}
          disabled={picking}
          className={
            className ??
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12.5px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          }
        >
          <span aria-hidden className="text-[14px]">
            📁
          </span>
          <span>绑定本地文件夹</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={startBindFlow}
          disabled={picking}
          className={
            className ??
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
          }
          style={{ background: "var(--gradient-button)" }}
        >
          <span aria-hidden>📁</span>
          {picking ? "扫描中…" : "绑定文件夹"}
        </button>
      )}

      {pending && (
        <BindFolderConfirmDialog
          folderPath={pending.folderPath}
          scan={pending.scan}
          peerLabel={peerLabel}
          onCancel={() => setPending(null)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}

// matrix-js-sdk's typed event maps don't know about our custom
// `com.magic.workspace.notification` field, so widen here. Same
// pattern as matrix-client/src/custom-events.ts.
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
 * Spec §5.2.3 — emit the v3 bind announcement once the local
 * registration succeeded. Three pieces:
 *
 *  1. A regular `m.text` message containing the file list + a short
 *     human/AI-facing primer telling the Agent it can ask the user
 *     about files. This is the heart of v3's design: any Matrix
 *     Agent sees this verbatim, no special protocol.
 *  2. If the tree exceeds 100 entries, a `workspace-manifest.txt`
 *     attachment so the Agent has an exhaustive list available.
 *  3. The `com.magic.workspace.binding` state event so other
 *     clients / devices can sync the bound state for UI purposes.
 */
const ANNOUNCE_PREVIEW_LIMIT = 50;
const FULL_MANIFEST_THRESHOLD = 100;

async function sendBindAnnouncement(
  rawClient: MatrixClient,
  roomId: string,
  userId: string,
  binding: WorkspaceBinding,
  files: WorkspaceFileEntry[],
): Promise<void> {
  const client = rawClient as unknown as AnyClient;

  const previewLines = files
    .slice(0, ANNOUNCE_PREVIEW_LIMIT)
    .map((f) => `- ${f.path}`)
    .join("\n");
  const remaining =
    files.length > ANNOUNCE_PREVIEW_LIMIT
      ? `\n- ... 还有 ${files.length - ANNOUNCE_PREVIEW_LIMIT} 个文件`
      : "";
  const announceBody = `📁 已绑定本地工作区：${binding.displayName}

包含 ${binding.fileCount} 个文件（${formatSize(binding.totalSize)}）

文件清单：
${previewLines}${remaining}

接下来当我提到文件路径（如 \`src/main.py\`）时，文件内容会自动附加到我的消息中。你可以基于实际文件内容回答我的问题。

如果需要查看完整文件清单，可以告诉我。`;

  await client.sendEvent(roomId, "m.room.message", {
    msgtype: "m.text",
    body: announceBody,
    "com.magic.workspace.notification": {
      kind: "bound",
      displayName: binding.displayName,
      fileCount: binding.fileCount,
    },
  });

  // Spec §3.2 step 6 — large tree: ship a manifest attachment so the
  // Agent has the full list without us bloating the announcement.
  if (files.length > FULL_MANIFEST_THRESHOLD) {
    try {
      const manifestText = files
        .map((f) => `${f.path} (${f.size} bytes)`)
        .join("\n");
      const blob = new Blob([manifestText], { type: "text/plain" });
      const upload = await client.uploadContent(blob, {
        type: "text/plain",
        name: "workspace-manifest.txt",
      });
      await client.sendEvent(roomId, "m.room.message", {
        msgtype: "m.file",
        body: "workspace-manifest.txt",
        info: {
          size: manifestText.length,
          mimetype: "text/plain",
        },
        url: (upload as { content_uri: string }).content_uri,
        "com.magic.workspace.attachment": {
          originalPath: "(manifest)",
          fromWorkspace: binding.displayName,
        },
      });
    } catch (err) {
      console.error("[workspace] manifest upload failed:", err);
    }
  }

  // Spec §5.2.3 — state event for cross-device sync. State key is
  // the binder's user id so multiple users can bind the same room
  // independently without overwriting each other.
  await client.sendStateEvent(
    roomId,
    MAGIC_EVENTS.WORKSPACE_BINDING,
    {
      bound: true,
      displayName: binding.displayName,
      boundBy: userId,
      boundAt: binding.boundAt,
      fileCount: binding.fileCount,
    },
    userId,
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
