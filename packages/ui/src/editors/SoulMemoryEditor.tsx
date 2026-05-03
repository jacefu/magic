import { useState, useEffect, useCallback } from "react";
import { useSoulMemory } from "../hooks/useSoulMemory.js";
import { MonacoWrapper } from "./MonacoWrapper.js";
import { DiffViewer } from "./DiffViewer.js";
import { EditorToolbar } from "./EditorToolbar.js";
import { EditorMeta } from "./EditorMeta.js";

interface SoulMemoryEditorProps {
  roomId: string;
}

export function SoulMemoryEditor({ roomId }: SoulMemoryEditorProps) {
  const [fileType, setFileType] = useState<"soul" | "memory">("soul");
  const [showDiff, setShowDiff] = useState(false);

  const {
    savedContent,
    editContent,
    meta,
    isDirty,
    isSaving,
    isLoading,
    error,
    setEditContent,
    save,
    revert,
  } = useSoulMemory({ roomId, fileType });

  useEffect(() => {
    setShowDiff(false);
  }, [fileType]);

  useEffect(() => {
    const handler = () => {
      if (isDirty && !isSaving) void save();
    };
    window.addEventListener("magic:editor-save", handler);
    return () => window.removeEventListener("magic:editor-save", handler);
  }, [isDirty, isSaving, save]);

  const handleFileTypeChange = useCallback(
    (type: "soul" | "memory") => {
      if (isDirty) {
        const ok = window.confirm("当前有未保存的修改，是否放弃？");
        if (!ok) return;
      }
      setFileType(type);
    },
    [isDirty],
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand-purple)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar
        fileType={fileType}
        onFileTypeChange={handleFileTypeChange}
        isDirty={isDirty}
        isSaving={isSaving}
        showDiff={showDiff}
        onToggleDiff={() => setShowDiff(!showDiff)}
        onSave={save}
        onRevert={revert}
      />

      <div className="min-h-0 flex-1">
        {showDiff ? (
          <DiffViewer original={savedContent} modified={editContent} />
        ) : (
          <MonacoWrapper value={editContent} onChange={setEditContent} />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border-default)]-light px-3 py-1.5">
        <EditorMeta
          version={meta.version}
          editor={meta.editor}
          lastSaved={meta.lastSaved}
        />
        {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
        {isDirty && <span className="text-xs text-[var(--color-warning)]">● 未保存</span>}
      </div>
    </div>
  );
}
