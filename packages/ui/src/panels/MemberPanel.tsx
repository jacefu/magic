import { useRoomMembers, type RoomMember } from "../hooks/useRoomMembers.js";
import { RoomAvatar } from "../rooms/RoomAvatar.js";

interface MemberPanelProps {
  roomId: string;
}

export function MemberPanel({ roomId }: MemberPanelProps) {
  const members = useRoomMembers(roomId);

  // Humans default to "online" (we don't track presence yet); agents follow
  // their declared status. Offline list only contains agents whose heartbeat
  // expired or who reported error.
  const online = members.filter(
    (m) => !m.isAgent || m.agentStatus === "active" || m.agentStatus === "idle",
  );
  const offline = members.filter(
    (m) => m.isAgent && (m.agentStatus === "offline" || m.agentStatus === "error"),
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {online.length > 0 && (
        <MemberSection label={`在线 — ${online.length}`} members={online} />
      )}
      {offline.length > 0 && (
        <MemberSection label={`离线 — ${offline.length}`} members={offline} />
      )}
      {online.length === 0 && offline.length === 0 && (
        <p className="px-3 py-4 text-xs text-text-muted">暂无成员</p>
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
      <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.04em] text-text-muted">
        {label}
      </p>
      {members.map((m) => (
        <MemberItem key={m.userId} member={m} />
      ))}
    </div>
  );
}

interface RuntimeTag {
  text: string;
  bg: string;
  color: string;
}

function getRuntimeTag(member: RoomMember): RuntimeTag | null {
  if (!member.isAgent) return null;
  const runtime = (member.agentRuntime ?? "").toLowerCase();
  if (runtime.includes("hermes")) {
    return { text: "HERMES", bg: "rgba(237,66,69,0.25)", color: "#F47B67" };
  }
  if (runtime.includes("qwenpaw") || runtime.includes("qwen")) {
    return { text: "QWENPAW", bg: "rgba(35,165,90,0.25)", color: "#57F287" };
  }
  return { text: "AGENT", bg: "rgba(88,101,242,0.25)", color: "#A5B0FC" };
}

function getStatusColor(member: RoomMember): string {
  if (!member.isAgent) return "#23A55A"; // humans default online
  switch (member.agentStatus) {
    case "active":
      return "#23A55A";
    case "idle":
      return "#F0B232";
    case "error":
      return "#F23F43";
    default:
      return "#6D6F78";
  }
}

function MemberItem({ member }: { member: RoomMember }) {
  const tag = getRuntimeTag(member);
  const statusColor = getStatusColor(member);

  return (
    <div className="group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-bg-hover">
      <div className="relative">
        <RoomAvatar
          name={member.displayName}
          avatarMxc={member.avatarMxc}
          isDirect
          size={28}
        />
        <div className="absolute -bottom-px -right-px flex h-2.5 w-2.5 items-center justify-center rounded-full bg-bg-secondary">
          <div
            className="h-[6px] w-[6px] rounded-full"
            style={{ backgroundColor: statusColor }}
          />
        </div>
      </div>

      <span className="flex-1 truncate text-[12.5px] text-text-muted group-hover:text-text-normal">
        {member.displayName}
      </span>
      {tag && (
        <span
          className="shrink-0 rounded-sm px-1 py-px text-[8px] font-bold"
          style={{ backgroundColor: tag.bg, color: tag.color }}
        >
          {tag.text}
        </span>
      )}
    </div>
  );
}
