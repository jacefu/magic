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
    <div className="flex items-center gap-2 border-b border-divider-light px-3 py-2">
      <div className="flex rounded-lg bg-bg-primary p-0.5">
        <button
          onClick={() => onFileTypeChange("soul")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            fileType === "soul"
              ? "bg-brand text-white"
              : "text-text-muted hover:text-text-normal"
          }`}
        >
          SOUL.md
        </button>
        <button
          onClick={() => onFileTypeChange("memory")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            fileType === "memory"
              ? "bg-brand text-white"
              : "text-text-muted hover:text-text-normal"
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
              ? "bg-brand/20 text-brand"
              : "text-text-muted hover:text-text-normal"
          }`}
          title="查看差异"
        >
          Diff
        </button>
      )}

      {isDirty && (
        <button
          onClick={onRevert}
          className="rounded px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-normal"
          title="放弃修改"
        >
          恢复
        </button>
      )}

      <button
        onClick={onSave}
        disabled={!isDirty || isSaving}
        className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white
                   transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
