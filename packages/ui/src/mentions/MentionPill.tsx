import { memo } from "react";
import { useAuthStore } from "@magic/matrix-client";

interface MentionPillProps {
  userId: string;
  displayName: string;
}

// Per design-system § 2.5 mention highlight colors (inline rgba so the
// values match the spec exactly without going through a token round-trip):
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
      className={`inline cursor-pointer rounded-[3px] px-[2px] font-medium transition-colors ${
        isMe
          ? "bg-[rgba(88,101,242,0.35)] text-white hover:bg-[rgba(88,101,242,0.55)]"
          : "bg-[rgba(88,101,242,0.25)] text-[#C9CDFB] hover:bg-[rgba(88,101,242,0.45)] hover:text-white"
      }`}
      title={userId}
    >
      @{displayName}
    </span>
  );
});
