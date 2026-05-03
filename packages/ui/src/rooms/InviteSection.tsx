import { memo, useState } from "react";
import type { RoomInvite } from "@magic/matrix-client";
import { InviteItem } from "./InviteItem.js";

interface InviteSectionProps {
  invites: RoomInvite[];
  onSelectInvite: (invite: RoomInvite) => void;
}

export const InviteSection = memo(function InviteSection({
  invites,
  onSelectInvite,
}: InviteSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (invites.length === 0) return null;

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-1 px-2.5 py-1.5
                   text-[10.5px] font-bold uppercase tracking-[0.04em]
                   text-[var(--color-warning)] transition-colors hover:text-[var(--text-primary)]"
      >
        <svg
          className={`h-2.5 w-2.5 transition-transform ${
            collapsed ? "" : "rotate-90"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>邀请</span>
        <span className="ml-1 rounded-full bg-[#FBBF24]/20 px-1.5 py-0.5 text-[10px]">
          {invites.length}
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-px">
          {invites.map((invite) => (
            <InviteItem
              key={invite.roomId}
              invite={invite}
              onClick={() => onSelectInvite(invite)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
