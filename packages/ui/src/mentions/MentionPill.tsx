import { memo } from "react";
import { useAuthStore } from "@magic/matrix-client";

interface MentionPillProps {
  userId: string;
  displayName: string;
}

// Per design-system § 2.5 mention highlight colors:
//   default: rgba(88,101,242,0.25) bg, #C9CDFB text
//   hover:   rgba(88,101,242,0.45) bg, #FFFFFF text
//   self:    rgba(88,101,242,0.35) bg, #FFFFFF text
export const MentionPill = memo(function MentionPill({
  userId,
  displayName,
}: MentionPillProps) {
  const currentUserId = useAuthStore((s) => s.userId);
  const isMe = userId === currentUserId;

  return (
    <span
      className={`inline cursor-pointer rounded px-1 py-0.5 text-sm font-medium transition-colors ${
        isMe
          ? "bg-brand/35 text-white"
          : "bg-brand/25 text-role-admin hover:bg-brand/45 hover:text-text-normal"
      }`}
      title={userId}
    >
      @{displayName}
    </span>
  );
});
