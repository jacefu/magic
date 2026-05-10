import { memo, useMemo } from "react";
import { getClient, hasClient, useAuthStore } from "@magic/matrix-client";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import { getAgentInfo } from "../lib/agentDetection.js";

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

  // Spec § 2.7 + § 11 — pill background and text color resolve via
  // CSS variables, so the same component renders correctly in both
  // themes. Self-mention reuses the hover variants for stronger
  // emphasis.
  const bg = isMe ? "var(--mention-bg-hover)" : "var(--mention-bg)";
  const bgHover = "var(--mention-bg-hover)";
  const color = isMe ? "var(--mention-color-hover)" : "var(--mention-color)";

  return (
    <span
      className="group inline-flex cursor-pointer items-center gap-1 rounded
                 px-1.5 py-px align-middle font-medium leading-tight
                 transition-colors"
      style={{ background: bg, color }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = bgHover;
        e.currentTarget.style.color = "var(--mention-color-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = bg;
        e.currentTarget.style.color = color;
      }}
      title={userId}
    >
      <RoomAvatar
        name={displayName}
        avatarMxc={avatarMxc}
        isDirect
        size={18}
        isAgent={getAgentInfo(userId).isAgent}
        userId={userId}
      />
      <span>@{displayName}</span>
    </span>
  );
});
