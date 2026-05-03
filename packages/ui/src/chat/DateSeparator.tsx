import { memo } from "react";

interface DateSeparatorProps {
  date: string;
}

export const DateSeparator = memo(function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="h-px flex-1 bg-[var(--border-hover)]" />
      <span className="text-xs font-semibold text-[var(--text-secondary)]">{date}</span>
      <div className="h-px flex-1 bg-[var(--border-hover)]" />
    </div>
  );
});
