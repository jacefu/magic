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

  return (
    <span
      className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-1 py-px align-middle font-medium leading-tight transition-colors ${
        isMe
          ? "bg-[rgba(88,101,242,0.35)] text-white hover:bg-[rgba(88,101,242,0.55)]"
          : "bg-[rgba(88,101,242,0.25)] text-[#C9CDFB] hover:bg-[rgba(88,101,242,0.45)] hover:text-white"
      }`}
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
