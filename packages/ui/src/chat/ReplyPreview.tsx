import type { SerializedMatrixEvent } from "@magic/shared-types";

interface ReplyPreviewProps {
  event: SerializedMatrixEvent;
  onCancel: () => void;
}

export function ReplyPreview({ event, onCancel }: ReplyPreviewProps) {
  const senderName = extractDisplayName(event.sender);
  const body = (event.content.body as string | undefined) ?? "";
  const preview = body.length > 80 ? body.slice(0, 80) + "…" : body;

  return (
    <div className="flex items-center gap-2 border-b border-[var(--border-default)]-light bg-[var(--bg-glass)]/50 px-4 py-2">
      <div className="w-0.5 self-stretch rounded-full bg-[var(--brand-purple)]" />

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--brand-purple)]">回复 {senderName}</p>
        <p className="truncate text-xs text-[var(--text-secondary)]">{preview}</p>
      </div>

      <button
        onClick={onCancel}
        className="shrink-0 rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]
                   transition-colors"
        title="取消回复"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function extractDisplayName(userId: string): string {
  const match = userId.match(/^@([^:]+)/);
  return match ? match[1] : userId;
}

function CloseIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
