import { useMemo, useState } from "react";
import type { WorkspaceFileEntry } from "@magic/shared-types";
import { DialogOverlay } from "../common/DialogOverlay.js";

interface WorkspaceFilePickerProps {
  fileTree: WorkspaceFileEntry[];
  initialSelected: string[];
  onConfirm: (paths: string[]) => void;
  onClose: () => void;
}

/**
 * Spec 022 v3 §5.2.5 — explicit file selector for the composer's 📁
 * button. Users prefer this over typing path names when they want to
 * attach multiple files (e.g. "compare these three") — and the
 * checkboxes side-step the auto-detection's "唯一文件名" ambiguity.
 *
 * The selection accumulates locally; only commits to the parent on
 * "附加到下一条消息". Cancelling discards everything (so accidentally
 * opening the picker is harmless).
 */
export function WorkspaceFilePicker({
  fileTree,
  initialSelected,
  onConfirm,
  onClose,
}: WorkspaceFilePickerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected),
  );
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return fileTree;
    const lower = filter.toLowerCase();
    return fileTree.filter((f) => f.path.toLowerCase().includes(lower));
  }, [filter, fileTree]);

  const totalSize = useMemo(
    () =>
      fileTree
        .filter((f) => selected.has(f.path))
        .reduce((sum, f) => sum + f.size, 0),
    [fileTree, selected],
  );

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <DialogOverlay onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[14px] border-[0.5px] border-[var(--border-default)] p-5"
        style={{
          background: "var(--bg-primary)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          animation: "fade-in-up 0.2s ease-out",
        }}
      >
        <h2
          className="text-[15px] font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          选择要附加的文件
        </h2>

        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="过滤文件…"
          className="mt-3 w-full rounded-md border-[0.5px] border-[var(--border-default)] px-3 py-1.5 text-[12px] outline-none transition-colors focus:border-[var(--border-active)]"
          style={{
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
          }}
        />

        <div
          className="mt-3 max-h-80 overflow-y-auto rounded-md"
          style={{ background: "var(--bg-surface)" }}
        >
          {filtered.length === 0 ? (
            <p
              className="px-3 py-6 text-center text-[11px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {fileTree.length === 0 ? "工作区为空" : "没有匹配的文件"}
            </p>
          ) : (
            filtered.map((f) => (
              <label
                key={f.path}
                className="flex cursor-pointer items-center gap-2 px-2 py-1 transition-colors hover:bg-[var(--bg-hover)]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(f.path)}
                  onChange={() => toggle(f.path)}
                  className="h-3.5 w-3.5 cursor-pointer accent-[var(--brand-purple)]"
                />
                <span
                  className="flex-1 truncate font-mono text-[11px]"
                  style={{ color: "var(--text-primary)" }}
                >
                  {f.path}
                </span>
                <span
                  className="shrink-0 text-[10px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {formatSize(f.size)}
                </span>
              </label>
            ))
          )}
        </div>

        <div
          className="mt-3 flex items-center justify-between text-[10.5px]"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>
            已选 {selected.size} / {fileTree.length} 个文件 ({formatSize(totalSize)})
          </span>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="transition-opacity hover:opacity-80"
              style={{ color: "var(--color-danger)" }}
            >
              清空
            </button>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border-[0.5px] border-[var(--border-default)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(Array.from(selected))}
            disabled={selected.size === 0}
            className="rounded-md px-4 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
            style={{ background: "var(--gradient-button)" }}
          >
            附加到下一条消息
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
