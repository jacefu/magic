import { memo } from "react";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import {
  getUserPresence,
  getPresenceColor,
} from "../lib/presenceUtils.js";
import type { MentionCandidate } from "../hooks/useMentionAutocomplete.js";

interface MentionItemProps {
  candidate: MentionCandidate;
  isSelected: boolean;
  onSelect: () => void;
}

export const MentionItem = memo(function MentionItem({
  candidate,
  isSelected,
  onSelect,
}: MentionItemProps) {
  if (candidate.type === "room") {
    return (
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={onSelect}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
          isSelected ? "bg-[var(--brand-purple)]/15" : "hover:bg-[var(--bg-glass)]"
        }`}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-warning)]/20 text-sm">
          📢
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">@全体成员</p>
          <p className="text-xs text-[var(--text-secondary)]">通知房间内所有人</p>
        </div>
      </button>
    );
  }

  const member = candidate.member!;

  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
        isSelected ? "bg-[var(--brand-purple)]/15" : "hover:bg-[var(--bg-glass)]"
      }`}
    >
      <div className="relative">
        <RoomAvatar
          name={member.displayName}
          avatarMxc={member.avatarMxc}
          isDirect
          size={28}
        />
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-bg-primary"
          style={{
            backgroundColor: getPresenceColor(getUserPresence(member.userId)),
          }}
          aria-hidden
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-[var(--text-primary)]">
            {member.displayName}
          </span>
          {member.isAgent && (
            <span className="shrink-0 rounded bg-[var(--role-human)]/20 px-1 py-0.5 text-[10px] font-medium text-[var(--role-human)]">
              Agent
            </span>
          )}
        </div>
        <p className="truncate text-xs text-[var(--text-secondary)]">
          {member.userId}
          {member.agentRuntime ? ` · ${member.agentRuntime}` : ""}
        </p>
      </div>
    </button>
  );
});
