import { memo } from "react";

interface UnreadBadgeProps {
  count: number;
  highlight?: boolean;
}

export const UnreadBadge = memo(function UnreadBadge({
  count,
  highlight = false,
}: UnreadBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : String(count);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-1.5
                  text-[10px] font-bold leading-4 text-white ${
        highlight ? "bg-red-500" : "bg-gray-600"
      }`}
      style={{ minWidth: "18px" }}
    >
      {displayCount}
    </span>
  );
});
