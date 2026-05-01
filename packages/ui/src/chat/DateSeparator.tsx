import { memo } from "react";

interface DateSeparatorProps {
  date: string;
}

export const DateSeparator = memo(function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-px flex-1 bg-bg-secondary" />
      <span className="text-xs font-medium text-text-muted">{date}</span>
      <div className="h-px flex-1 bg-bg-secondary" />
    </div>
  );
});
