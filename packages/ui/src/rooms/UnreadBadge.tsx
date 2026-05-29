import { memo } from "react";

interface UnreadBadgeProps {
  count: number;
  highlight?: boolean;
}

// Cosmic AI § 7.8 — mention / high-priority unread uses the pink→orange
// gradient ("energy" / attention-grabbing); ordinary unread uses a
// solid red so it actually reads as "this has new messages" against
// dark backgrounds. The previous "low-key translucent white" muted
// pill was too easy to miss — users were dropping incoming DMs
// because the badge faded into the sidebar.
//
// Cap at "99+", 16x16 min size, 9px bold white text on both branches.
export const UnreadBadge = memo(function UnreadBadge({
  count,
  highlight = false,
}: UnreadBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : String(count);

  return (
    <span
      className="inline-flex h-4 min-w-4 items-center justify-center rounded-md
                 px-1 text-[9px] font-bold leading-none text-white"
      style={
        highlight
          ? {
              background: "var(--gradient-badge)",
              boxShadow: "0 0 6px rgba(244, 63, 94, 0.45)",
            }
          : {
              background: "var(--color-danger)",
            }
      }
    >
      {displayCount}
    </span>
  );
});
