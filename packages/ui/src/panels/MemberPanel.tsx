import { useRoomMembers, type RoomMember } from "../hooks/useRoomMembers.js";
import { RoomAvatar } from "../rooms/RoomAvatar.js";

interface MemberPanelProps {
  roomId: string;
}

export function MemberPanel({ roomId }: MemberPanelProps) {
  const members = useRoomMembers(roomId);

  const online = members.filter(
    (m) =>
      m.agentStatus === "active" ||
      m.agentStatus === "idle" ||
      !m.isAgent,
  );
  const offline = members.filter(
    (m) => m.isAgent && (m.agentStatus === "offline" || m.agentStatus === "error"),
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Online */}
      {online.length > 0 && (
        <MemberSection label={`在线 — ${online.length}`} members={online} />
      )}
      {/* Offline */}
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
  const statusColor = member.isAgent
    ? member.agentStatus === "active"
      ? "#23A55A"
      : member.agentStatus === "idle"
        ? "#F0B232"
        : member.agentStatus === "error"
          ? "#F23F43"
          : "#6D6F78"
    : "#23A55A";

  const runtimeTag = member.isAgent
    ? member.agentRuntime?.includes("hermes")
      ? { text: "HERMES", bg: "rgba(237,66,69,0.25)", color: "#F47B67" }
      : member.agentRuntime?.includes("qwenpaw") ||
          member.agentRuntime?.includes("copaw")
        ? { text: "QWENPAW", bg: "rgba(35,165,90,0.25)", color: "#57F287" }
        : { text: "AGENT", bg: "rgba(88,101,242,0.25)", color: "#A5B0FC" }
    : null;

  return (
    <div className="group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[#35373C]">
      {/* Avatar + status */}
      <div className="relative">
        <RoomAvatar name={name} avatarMxc={member.avatarMxc} isDirect size={28} />
        <div className="absolute -bottom-px -right-px flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#2B2D31]">
          <div
            className="h-[6px] w-[6px] rounded-full"
            style={{ backgroundColor: statusColor }}
          />
        </div>
      </div>

      {/* Name + tag */}
      <span className="flex-1 truncate text-[12.5px] text-[#949BA4] group-hover:text-[#DBDEE1]">
        {name}
      </span>
      {runtimeTag && (
        <span
          className="shrink-0 rounded-sm px-1 py-px text-[8px] font-bold"
          style={{ backgroundColor: runtimeTag.bg, color: runtimeTag.color }}
        >
          {runtimeTag.text}
        </span>
      )}
    </div>
  );
}
