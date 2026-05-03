import type { UploadTask } from "../hooks/useFileUpload.js";

interface UploadProgressBarProps {
  tasks: UploadTask[];
  onCancel: (taskId: string) => void;
}

export function UploadProgressBar({ tasks, onCancel }: UploadProgressBarProps) {
  const activeTasks = tasks.filter((t) => t.status === "uploading");
  if (activeTasks.length === 0) return null;

  return (
    <div className="space-y-1.5 border-t border-[var(--border-default)]-light bg-[var(--bg-glass)]/50 px-4 py-2">
      {activeTasks.map((task) => (
        <div key={task.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="truncate text-xs text-[var(--text-primary)]">{task.file.name}</span>
              <span className="shrink-0 text-xs text-[var(--text-secondary)]">{task.progress}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--bg-surface)]">
              <div
                className="h-full rounded-full bg-[var(--brand-purple)] transition-all duration-300"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => onCancel(task.id)}
            className="shrink-0 rounded p-0.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--color-danger)]"
            title="取消上传"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
