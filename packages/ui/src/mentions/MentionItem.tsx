import { memo } from "react";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import { AgentStatusDot } from "../agents/AgentStatusDot.js";
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
          isSelected ? "bg-brand/15" : "hover:bg-bg-secondary"
        }`}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow/20 text-sm">
          📢
        </div>
        <div>
          <p className="text-sm font-medium text-text-normal">@全体成员</p>
          <p className="text-xs text-text-muted">通知房间内所有人</p>
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
        isSelected ? "bg-brand/15" : "hover:bg-bg-secondary"
      }`}
    >
      <div className="relative">
        <RoomAvatar
          name={member.displayName}
          avatarMxc={member.avatarMxc}
          isDirect
          size={28}
        />
        {member.isAgent && member.agentStatus && (
          <span className="absolute -bottom-0.5 -right-0.5">
            <AgentStatusDot
              status={
                member.agentStatus === "online" ? "active" : member.agentStatus
              }
              size="sm"
            />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-text-normal">
            {member.displayName}
          </span>
          {member.isAgent && (
            <span className="shrink-0 rounded bg-role-admin/20 px-1 py-0.5 text-[10px] font-medium text-role-admin">
              Agent
            </span>
          )}
        </div>
        <p className="truncate text-xs text-text-muted">
          {member.userId}
          {member.agentRuntime ? ` · ${member.agentRuntime}` : ""}
        </p>
      </div>
    </button>
  );
});
