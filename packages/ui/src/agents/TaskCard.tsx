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
  critical: "bg-[var(--color-danger)]/20 text-[var(--color-danger)]",
  high: "bg-[var(--color-warning)]/20 text-[var(--color-warning)]",
  medium: "bg-[var(--brand-purple)]/20 text-[var(--role-human)]",
  low: "bg-[var(--bg-surface)] text-[var(--text-secondary)]",
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
      className={`rounded-lg border border-l-2 border-[var(--border-default)]-light ${priorityBorder[task.priority]}
                  bg-[var(--bg-glass)] p-2.5 transition-colors hover:border-[var(--border-default)]`}
    >
      <p className="line-clamp-2 text-sm font-medium text-[var(--text-primary)]">{task.title}</p>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)]">→ {assigneeName}</span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${priorityBadge[task.priority]}`}
        >
          {priorityLabels[task.priority]}
        </span>
      </div>

      {task.dueDate && (
        <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">截止: {task.dueDate}</p>
      )}
    </div>
  );
});
