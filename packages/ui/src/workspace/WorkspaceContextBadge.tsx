interface WorkspaceContextBadgeProps {
  workspace: string;
  contextLength?: number;
}

/**
 * Spec 022 v6 §6.4 — tiny inline pill rendered next to user messages
 * whose body was prepended with a `<workspace_context>` block. Lets
 * the sender see "yep, my message went out with the workspace
 * context attached" without revealing the actual block in the chat.
 */
export function WorkspaceContextBadge({
  workspace,
  contextLength,
}: WorkspaceContextBadgeProps) {
  const tooltip = contextLength
    ? `已附带 ${workspace} 目录树 + 项目说明（${formatBytes(contextLength)}）`
    : `已附带 ${workspace} 目录树 + 项目说明`;
  return (
    <span
      title={tooltip}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium align-middle"
      style={{
        background: "var(--mention-bg)",
        color: "var(--mention-color)",
      }}
    >
      <span aria-hidden>📎</span>
      <span className="max-w-[120px] truncate">{workspace}</span>
    </span>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} 字符`;
  return `${(n / 1024).toFixed(1)} KB`;
}
