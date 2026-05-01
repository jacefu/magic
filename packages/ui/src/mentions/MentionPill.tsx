import { memo } from "react";
import { useAuthStore } from "@magic/matrix-client";

interface MentionPillProps {
  userId: string;
  displayName: string;
}

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
          ? "bg-magic-primary/25 text-magic-primary"
          : "bg-gray-700/50 text-blue-300 hover:bg-gray-600/50"
      }`}
      title={userId}
    >
      @{displayName}
    </span>
  );
});
