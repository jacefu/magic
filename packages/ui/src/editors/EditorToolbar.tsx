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
    <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
      <div className="flex rounded-lg bg-magic-surface p-0.5">
        <button
          onClick={() => onFileTypeChange("soul")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            fileType === "soul"
              ? "bg-magic-primary text-white"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          SOUL.md
        </button>
        <button
          onClick={() => onFileTypeChange("memory")}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            fileType === "memory"
              ? "bg-magic-primary text-white"
              : "text-gray-400 hover:text-gray-200"
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
              ? "bg-magic-primary/20 text-magic-primary"
              : "text-gray-400 hover:text-gray-200"
          }`}
          title="查看差异"
        >
          Diff
        </button>
      )}

      {isDirty && (
        <button
          onClick={onRevert}
          className="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:text-gray-200"
          title="放弃修改"
        >
          恢复
        </button>
      )}

      <button
        onClick={onSave}
        disabled={!isDirty || isSaving}
        className="rounded-lg bg-magic-primary px-3 py-1 text-xs font-medium text-white
                   transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSaving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
