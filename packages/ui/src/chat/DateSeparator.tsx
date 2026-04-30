import { memo } from "react";

interface DateSeparatorProps {
  date: string;
}

export const DateSeparator = memo(function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-px flex-1 bg-gray-800" />
      <span className="text-xs font-medium text-gray-500">{date}</span>
      <div className="h-px flex-1 bg-gray-800" />
    </div>
  );
});
