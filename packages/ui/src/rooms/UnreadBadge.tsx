import { memo } from "react";

interface UnreadBadgeProps {
  count: number;
  highlight?: boolean;
}

// Cosmic AI § 7.8 — mention / high-priority unread uses a pink→orange
// gradient ("energy"); ordinary unread is a low-key translucent white
// pill. Both cap at "99+", 16x16 min size, 9px bold white text.
export const UnreadBadge = memo(function UnreadBadge({
  count,
  highlight = false,
}: UnreadBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : String(count);

  return (
    <span
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-md
                 px-1 text-[9px] font-bold leading-none"
      style={
        highlight
          ? {
              background: "var(--gradient-badge)",
              color: "#FFFFFF",
            }
          : {
              background: "var(--badge-muted)",
              color: "var(--badge-muted-color)",
            }
      }
    >
      {displayCount}
    </span>
  );
});
