import { memo } from "react";
import type { TaskData } from "@magic/matrix-client";

interface TaskCardProps {
  task: TaskData;
}

const priorityBorder: Record<TaskData["priority"], string> = {
  critical: "border-l-red",
  high: "border-l-yellow",
  medium: "border-l-brand",
  low: "border-l-text-faint",
};

const priorityBadge: Record<TaskData["priority"], string> = {
  critical: "bg-red/20 text-red",
  high: "bg-yellow/20 text-yellow",
  medium: "bg-brand/20 text-role-admin",
  low: "bg-bg-modifier text-text-muted",
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
      className={`rounded-lg border border-l-2 border-divider-light ${priorityBorder[task.priority]}
                  bg-bg-secondary p-2.5 transition-colors hover:border-divider`}
    >
      <p className="line-clamp-2 text-sm font-medium text-text-normal">{task.title}</p>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-text-muted">→ {assigneeName}</span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${priorityBadge[task.priority]}`}
        >
          {priorityLabels[task.priority]}
        </span>
      </div>

      {task.dueDate && (
        <p className="mt-1 text-[10px] text-text-faint">截止: {task.dueDate}</p>
      )}
    </div>
  );
});
