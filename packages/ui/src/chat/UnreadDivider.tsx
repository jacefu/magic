import { memo } from "react";

interface UnreadDividerProps {
  /**
   * When the unread divider lands on a calendar boundary, the date label
   * (e.g. "2026年4月30日") is rendered centered on the rule, replacing the
   * regular date separator that would otherwise appear here. When null the
   * divider is just a red rule + 新的 badge.
   */
  date: string | null;
}

// Discord "first unread" marker: a red horizontal rule with the 新的 badge
// floating on the right. When it coincides with a date boundary the date
// label sits centered on the rule and takes the place of DateSeparator.
export const UnreadDivider = memo(function UnreadDivider({
  date,
}: UnreadDividerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-px flex-1 bg-[#F43F5E]" />
      {date && (
        <>
          <span className="text-xs font-semibold text-[var(--color-danger)]">{date}</span>
          <div className="h-px flex-1 bg-[#F43F5E]" />
        </>
      )}
      <span className="shrink-0 rounded-sm bg-[#F43F5E] px-1.5 py-px text-[10px] font-bold leading-none text-white">
        新的
      </span>
    </div>
  );
});
