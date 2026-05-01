import type { UploadTask } from "../hooks/useFileUpload.js";

interface UploadProgressBarProps {
  tasks: UploadTask[];
  onCancel: (taskId: string) => void;
}

export function UploadProgressBar({ tasks, onCancel }: UploadProgressBarProps) {
  const activeTasks = tasks.filter((t) => t.status === "uploading");
  if (activeTasks.length === 0) return null;

  return (
    <div className="space-y-1.5 border-t border-gray-800 bg-magic-surface-alt/50 px-4 py-2">
      {activeTasks.map((task) => (
        <div key={task.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center justify-between">
              <span className="truncate text-xs text-gray-300">{task.file.name}</span>
              <span className="shrink-0 text-xs text-gray-500">{task.progress}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-gray-700">
              <div
                className="h-full rounded-full bg-magic-primary transition-all duration-300"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => onCancel(task.id)}
            className="shrink-0 rounded p-0.5 text-gray-500 transition-colors hover:text-red-400"
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
