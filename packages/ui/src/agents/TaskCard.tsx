import { memo } from "react";
import type { TaskData } from "@magic/matrix-client";

interface TaskCardProps {
  task: TaskData;
}

const priorityBorder: Record<TaskData["priority"], string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-blue-500",
  low: "border-l-gray-500",
};

const priorityBadge: Record<TaskData["priority"], string> = {
  critical: "bg-red-500/20 text-red-400",
  high: "bg-orange-500/20 text-orange-400",
  medium: "bg-gray-800 text-gray-400",
  low: "bg-gray-800 text-gray-400",
};

const priorityLabels: Record<TaskData["priority"], string> = {
  critical: "紧急",
  high: "高",
  medium: "中",
  low: "低",
};

export const TaskCard = memo(function TaskCard({ task }: TaskCardProps) {
  const assigneeName = task.assignee.match(/^@([^:]+)/)?.[1] ?? task.assignee;

  return (
    <div
      className={`rounded-lg border border-l-2 border-gray-800 ${priorityBorder[task.priority]}
                  bg-magic-surface-alt p-2.5 transition-colors hover:border-gray-700`}
    >
      <p className="line-clamp-2 text-sm font-medium text-gray-200">{task.title}</p>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">→ {assigneeName}</span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${priorityBadge[task.priority]}`}
        >
          {priorityLabels[task.priority]}
        </span>
      </div>

      {task.dueDate && (
        <p className="mt-1 text-[10px] text-gray-600">截止: {task.dueDate}</p>
      )}
    </div>
  );
});
