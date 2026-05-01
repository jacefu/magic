import { useEffect, useMemo } from "react";
import type { UploadTask } from "../hooks/useFileUpload.js";

interface FileUploadPreviewProps {
  tasks: UploadTask[];
  onConfirm: () => void;
  onCancel: () => void;
  onRemove: (taskId: string) => void;
}

export function FileUploadPreview({
  tasks,
  onConfirm,
  onCancel,
  onRemove,
}: FileUploadPreviewProps) {
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  if (pendingTasks.length === 0) return null;

  return (
    <div className="border-t border-gray-800 bg-magic-surface-alt/50 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-300">
          {pendingTasks.length} 个文件待发送
        </span>
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 transition-colors hover:text-gray-300"
        >
          全部取消
        </button>
      </div>

      <div className="max-h-40 space-y-1.5 overflow-y-auto">
        {pendingTasks.map((task) => (
          <FilePreviewItem
            key={task.id}
            task={task}
            onRemove={() => onRemove(task.id)}
          />
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={onConfirm}
          className="rounded-lg bg-magic-primary px-4 py-1.5 text-sm font-medium
                     text-white transition-colors hover:bg-blue-600"
        >
          发送 {pendingTasks.length > 1 ? `(${pendingTasks.length})` : ""}
        </button>
      </div>
    </div>
  );
}

function FilePreviewItem({
  task,
  onRemove,
}: {
  task: UploadTask;
  onRemove: () => void;
}) {
  const preview = useMemo(() => {
    if (task.file.type.startsWith("image/")) {
      return URL.createObjectURL(task.file);
    }
    return null;
  }, [task.file]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-magic-surface px-2.5 py-1.5">
      {preview ? (
        <img
          src={preview}
          alt={task.file.name}
          className="h-10 w-10 rounded object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-800 text-lg">
          {getFileEmoji(task.file.type)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-200">{task.file.name}</p>
        <p className="text-xs text-gray-500">{formatFileSize(task.file.size)}</p>
      </div>

      <button
        onClick={onRemove}
        className="shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-gray-700 hover:text-gray-300"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function getFileEmoji(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  return "📎";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
