import { memo } from "react";

interface UnreadBadgeProps {
  count: number;
  highlight?: boolean;
}

// Per design-system § 7.6:
//   @mention / 高优先级: bg #F23F43 (red)
//   普通未读:           bg #6D6F78 (text-faint)
//   16 × 16 min, 10px bold white text, rounded-full
export const UnreadBadge = memo(function UnreadBadge({
  count,
  highlight = false,
}: UnreadBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : String(count);

  return (
    <span
      className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full
                  px-1 text-[10px] font-bold leading-none text-white ${
                    highlight ? "bg-[#F23F43]" : "bg-[#6D6F78]"
                  }`}
    >
      {displayCount}
    </span>
  );
});
