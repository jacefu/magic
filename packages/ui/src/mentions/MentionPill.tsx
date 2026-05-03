import { memo, useMemo } from "react";
import { getClient, hasClient, useAuthStore } from "@magic/matrix-client";
import { RoomAvatar } from "../rooms/RoomAvatar.js";

interface MentionPillProps {
  userId: string;
  displayName: string;
}

// Mention pill: a rounded rectangle (NOT pill/oval) with a small round
// avatar followed by "@displayName". Brand-tinted background per design
// system § 2.5; brighter variant when the mention targets the current
// user.
export const MentionPill = memo(function MentionPill({
  userId,
  displayName,
}: MentionPillProps) {
  const currentUserId = useAuthStore((s) => s.userId);
  const isMe = userId === currentUserId;

  const avatarMxc = useMemo(() => {
    if (!hasClient()) return null;
    try {
      return getClient().getUser(userId)?.avatarUrl ?? null;
    } catch {
      return null;
    }
  }, [userId]);

  // Cosmic AI § 2.7 — pill background is a translucent purple→cyan
  // gradient. Self-mention bumps opacity + uses pure white text;
  // hover brightens both. The gradient lives in `style` because
  // Tailwind v4 arbitrary backgrounds can't accept comma-separated
  // gradient stops without escaping pain.
  const gradientDefault =
    "linear-gradient(135deg, rgba(108,92,231,0.25), rgba(0,180,216,0.15))";
  const gradientHover =
    "linear-gradient(135deg, rgba(108,92,231,0.4), rgba(0,180,216,0.3))";
  const gradientSelf =
    "linear-gradient(135deg, rgba(108,92,231,0.35), rgba(0,180,216,0.25))";
  const gradientSelfHover =
    "linear-gradient(135deg, rgba(108,92,231,0.5), rgba(0,180,216,0.4))";

  return (
    <span
      className={`group inline-flex cursor-pointer items-center gap-1 rounded
                  px-1.5 py-px align-middle font-medium leading-tight
                  transition-colors ${
                    isMe ? "text-white" : "text-[#A5B4FC] hover:text-white"
                  }`}
      style={{ background: isMe ? gradientSelf : gradientDefault }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isMe
          ? gradientSelfHover
          : gradientHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isMe
          ? gradientSelf
          : gradientDefault;
      }}
      title={userId}
    >
      <RoomAvatar
        name={displayName}
        avatarMxc={avatarMxc}
        isDirect
        size={18}
      />
      <span>@{displayName}</span>
    </span>
  );
});
