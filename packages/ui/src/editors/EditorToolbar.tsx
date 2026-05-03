interface EditorToolbarProps {
  fileType: "soul" | "memory";
  onFileTypeChange: (type: "soul" | "memory") => void;
  isDirty: boolean;
  isSaving: boolean;
  showDiff: boolean;
  onToggleDiff: () => void;
  onSave: () => void;
  onRevert: () => void;
}

export function EditorToolbar({
  fileType,
  onFileTypeChange,
  isDirty,
  isSaving,
  showDiff,
  onToggleDiff,
  onSave,
  onRevert,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border-default)]-light px-3 py-2">
      <div className="flex rounded-lg bg-[var(--bg-primary)] p-0.5">
        <button
          onClick={() => onFileTypeChange("soul")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            fileType === "soul"
              ? "bg-[var(--brand-purple)] text-white"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          SOUL.md
        </button>
        <button
          onClick={() => onFileTypeChange("memory")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            fileType === "memory"
              ? "bg-[var(--brand-purple)] text-white"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          MEMORY.md
        </button>
      </div>

      <div className="flex-1" />

      {isDirty && (
        <button
          onClick={onToggleDiff}
          className={`rounded px-2 py-1 text-xs transition-colors ${
            showDiff
              ? "bg-[var(--brand-purple)]/20 text-[var(--brand-purple)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          title="查看差异"
        >
          Diff
        </button>
      )}

      {isDirty && (
        <button
          onClick={onRevert}
          className="rounded px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          title="放弃修改"
        >
          恢复
        </button>
      )}

      <button
        onClick={onSave}
        disabled={!isDirty || isSaving}
        className="rounded-lg bg-[var(--brand-purple)] px-3 py-1 text-xs font-medium text-white
                   transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
