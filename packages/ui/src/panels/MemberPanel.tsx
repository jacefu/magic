import { useRoomMembers, type RoomMember } from "../hooks/useRoomMembers.js";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import { AgentTag } from "../agents/AgentTag.js";
import { getStatusColor, getHumanOnlineStatus } from "../lib/agentDetection.js";

interface MemberPanelProps {
  roomId: string;
}

export function MemberPanel({ roomId }: MemberPanelProps) {
  const members = useRoomMembers(roomId);

  // Online: any agent reporting online/idle, plus humans whose presence isn't offline.
  // Offline: agents in offline/error state, and humans without presence data.
  const online = members.filter((m) => {
    if (m.isAgent) {
      return m.agentStatus === "online" || m.agentStatus === "idle";
    }
    return getHumanOnlineStatus(m.userId) !== "offline";
  });
  const offline = members.filter((m) => {
    if (m.isAgent) {
      return (
        m.agentStatus === "offline" ||
        m.agentStatus === "error" ||
        m.agentStatus === null ||
        m.agentStatus === undefined
      );
    }
    return getHumanOnlineStatus(m.userId) === "offline";
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {online.length > 0 && (
        <MemberSection label={`在线 — ${online.length}`} members={online} />
      )}
      {offline.length > 0 && (
        <MemberSection label={`离线 — ${offline.length}`} members={offline} />
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
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-[#949BA4]">
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
  const statusColor = getStatusColor(member.userId);

  return (
    <div className="group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#35373C]">
      {/* Avatar with status dot — 8px dot inside 12px ring (panel-bg colored) */}
      <div className="relative">
        <RoomAvatar name={name} avatarMxc={member.avatarMxc} isDirect size={28} />
        <div className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-[#2B2D31]">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
        </div>
      </div>

      {/* Name + runtime tag */}
      <span
        className={`flex-1 truncate text-[12.5px] ${
          member.isAgent ? "" : "text-[#949BA4] group-hover:text-[#DBDEE1]"
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
