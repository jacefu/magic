import { useRoomMembers, type RoomMember } from "../hooks/useRoomMembers.js";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import { AgentTag } from "../agents/AgentTag.js";

interface MemberPanelProps {
  roomId: string;
}

// Spec 019 FIX-1 — Tuwunel Presence is unreliable, so the panel no
// longer groups by online/offline. Members are split by role (Agent
// vs human) which is information we always have correctly via
// `getAgentInfo`. Avatar status dot is dropped along with the
// presence-driven grouping.
export function MemberPanel({ roomId }: MemberPanelProps) {
  const members = useRoomMembers(roomId);

  const agents = members.filter((m) => m.isAgent);
  const humans = members.filter((m) => !m.isAgent);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {agents.length > 0 && (
        <MemberSection label={`Agent — ${agents.length}`} members={agents} />
      )}
      {humans.length > 0 && (
        <MemberSection label={`成员 — ${humans.length}`} members={humans} />
      )}
    </div>
  );
}

function MemberSection({
  label,
  members,
}: {
  label: string;
  members: RoomMember[];
}) {
  return (
    <div className="px-3 pt-4">
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
        {label}
      </p>
      {members.map((m) => (
        <MemberItem key={m.userId} member={m} />
      ))}
    </div>
  );
}

function MemberItem({ member }: { member: RoomMember }) {
  const name = member.displayName;

  return (
    <div className="group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[var(--bg-surface)]">
      <RoomAvatar name={name} avatarMxc={member.avatarMxc} isDirect size={28} />

      {/* Name + runtime tag */}
      <span
        className={`flex-1 truncate text-[12.5px] ${
          member.isAgent ? "" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
        }`}
        style={
          member.isAgent ? { color: member.agentInfo.nameColor } : undefined
        }
      >
        {name}
      </span>
      <AgentTag agentInfo={member.agentInfo} size="sm" />
    </div>
  );
}
