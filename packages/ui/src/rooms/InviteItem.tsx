import { memo } from "react";
import type { RoomInvite } from "@magic/matrix-client";

interface InviteItemProps {
  invite: RoomInvite;
  onClick: () => void;
}

export const InviteItem = memo(function InviteItem({
  invite,
  onClick,
}: InviteItemProps) {
  const displayName =
    invite.roomName ?? (invite.isDirect ? invite.inviterName : "未命名房间");

  return (
    <button
      onClick={onClick}
      className="mx-1.5 flex w-[calc(100%-12px)] items-center gap-1.5 rounded-md
                 px-2.5 py-[5px] text-left text-[rgba(255,255,255,0.4)] transition-colors
                 duration-100 hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.85)]"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#FBBF24]">
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
          />
        </svg>
      </span>

      <span className="flex-1 truncate text-[13px]">{displayName}</span>

      {invite.status === "accepting" && (
        <div
          className="h-3 w-3 animate-spin rounded-full border border-[#00F5A0] border-t-transparent"
          aria-label="接受中"
        />
      )}
      {invite.status === "declining" && (
        <div
          className="h-3 w-3 animate-spin rounded-full border border-[#F23F43] border-t-transparent"
          aria-label="拒绝中"
        />
      )}
      {invite.status === "pending" && (
        <span className="shrink-0 rounded bg-[#FBBF24]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#FBBF24]">
          邀请
        </span>
      )}
    </button>
  );
});
