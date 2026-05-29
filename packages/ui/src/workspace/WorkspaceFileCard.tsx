import { useState } from "react";

interface WorkspaceFileCardProps {
  path: string;
  size: number;
  /** Raw body of the projection message — for text projections this is
   *  the `📄 path\n```lang\n…content…\n``` ` block; for binary uploads
   *  it's just the filename. We surface it as a collapsed code block
   *  on expand so the user can see what the Agent received. */
  rawBody: string;
  /** Indicates a file_error projection rather than a successful file. */
  isError?: boolean;
}

/**
 * Spec 022 v6 §6.4 — folded card replacing the noisy raw projection
 * payload in the chat timeline. The Agent reads the full body off the
 * raw event; the user just sees "📄 path · 2.3 KB ▸".
 */
export function WorkspaceFileCard({
  path,
  size,
  rawBody,
  isError,
}: WorkspaceFileCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="my-1 rounded-lg text-xs"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border-default)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
      >
        <span aria-hidden className="text-[14px]">
          📄
        </span>
        <span
          className="truncate font-mono text-[11.5px]"
          style={{ color: "var(--text-primary)" }}
        >
          {path}
        </span>
        <span
          className="ml-auto shrink-0 text-[10.5px]"
          style={{
            color: isError ? "var(--color-danger)" : "var(--text-tertiary)",
          }}
        >
          {isError ? "读取失败" : formatSize(size)}
        </span>
        <span
          aria-hidden
          className="shrink-0 text-[10px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {expanded ? "▾" : "▸"}
        </span>
      </button>
      {expanded && (
        <pre
          className="overflow-x-auto px-3 pb-3 pt-1 text-[11px] leading-[1.45]"
          style={{ color: "var(--text-secondary)" }}
        >
          {rawBody}
        </pre>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
