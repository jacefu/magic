import type { SerializedMatrixEvent } from "@magic/shared-types";

interface WorkspaceNotificationMeta {
  kind: "bound" | "unbound" | "updated";
  binding_owner: string;
  displayName: string;
  fileCount?: number;
  totalSize?: number;
}

interface WorkspaceNotificationCardProps {
  event: SerializedMatrixEvent;
}

/**
 * Spec 022 §3.5.5 — render the `m.notice` agent-awareness messages
 * as compact status cards instead of pasting the raw prompt body
 * into the chat. The original message stays on the room timeline
 * with its full body intact, so the Agent's LLM still sees it
 * exactly as authored — only the human view changes.
 */
export function WorkspaceNotificationCard({
  event,
}: WorkspaceNotificationCardProps) {
  const meta = event.content?.[
    "com.magic.workspace.notification"
  ] as WorkspaceNotificationMeta | undefined;
  if (!meta) return null;

  if (meta.kind === "bound") {
    return (
      <div
        className="my-1 rounded-lg p-3"
        style={{
          background: "var(--bg-surface)",
          border: "0.5px solid var(--border-default)",
        }}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-base">
            📁
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            工作区已绑定：{meta.displayName}
          </span>
        </div>
        <p
          className="mt-1 text-[11px]"
          style={{ color: "var(--text-secondary)" }}
        >
          {meta.fileCount ?? 0} 个文件
          {typeof meta.totalSize === "number" &&
            ` · ${formatSize(meta.totalSize)}`}
        </p>
        <p
          className="mt-1 text-[10px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Agent 现在可以按需读取此文件夹中的文件
        </p>
      </div>
    );
  }

  if (meta.kind === "unbound") {
    return (
      <div
        className="my-1 rounded-lg p-2"
        style={{ background: "var(--bg-surface)" }}
      >
        <p
          className="text-[11px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          📁 工作区已解绑：{meta.displayName}
        </p>
      </div>
    );
  }

  if (meta.kind === "updated") {
    return (
      <div
        className="my-1 text-center text-[10px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        📁 {meta.displayName} 已更新
        {typeof meta.fileCount === "number" &&
          `（${meta.fileCount} 个文件）`}
      </div>
    );
  }

  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
