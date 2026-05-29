import { useCallback } from "react";
import { createDM, useRoomStore } from "@magic/matrix-client";
import { useRoomMembers, type RoomMember } from "../hooks/useRoomMembers.js";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import { AgentTag } from "../agents/AgentTag.js";

interface MemberPanelProps {
  roomId: string;
}

// Spec 020 FIX-5 — drop the Agent / 成员 split. Agent detection is
// imperfect enough (CRD lookups fail, name patterns miss, etc.) that
// the grouping read as arbitrary noise rather than a useful filter.
// The runtime tag (`MANAGER` / `AGENT` / `HERMES` / `QWENPAW`) on each
// row still tells you who's an Agent — just no longer as a section.
//
// Spec 022 v6 follow-up — include the locally-logged-in user in the
// roster (useRoomMembers stopped filtering them out). The roster's
// sort already puts agents → self → others, so we render the
// useRoomMembers output verbatim without a secondary sort.
export function MemberPanel({ roomId }: MemberPanelProps) {
  const members = useRoomMembers(roomId);

  if (members.length === 0) {
    return null;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="px-3 pt-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          成员 — {members.length}
        </p>
        {members.map((m) => (
          <MemberItem key={m.userId} member={m} />
        ))}
      </div>
    </div>
  );
}

function MemberItem({ member }: { member: RoomMember }) {
  const name = member.displayName;

  // Spec 020 FIX-3 — clicking a non-self member starts (or reuses) a
  // 1:1 DM with them. createDM consults `m.direct` first, so
  // repeatedly clicking the same person doesn't pile up empty rooms.
  // Clicking yourself is a no-op (no point DMing yourself).
  const handleClick = useCallback(async () => {
    if (member.isSelf) return;
    try {
      const dmRoomId = await createDM(member.userId);
      useRoomStore.getState().setActiveRoom(dmRoomId);
    } catch (err) {
      console.error("发起私聊失败:", (err as Error).message);
    }
  }, [member.userId, member.isSelf]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={member.isSelf}
      title={member.isSelf ? `${name}（我）` : `与 ${name} 私聊`}
      className={`group flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left
                  ${
                    member.isSelf
                      ? "cursor-default"
                      : "cursor-pointer hover:bg-[var(--bg-surface)]"
                  }`}
    >
      <RoomAvatar
        name={name}
        avatarMxc={member.avatarMxc}
        isDirect
        size={28}
        isAgent={member.isAgent}
        userId={member.userId}
      />

      {/* Name + runtime tag + self badge */}
      <span
        className={`flex-1 truncate text-[12.5px] ${
          member.isAgent
            ? ""
            : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
        }`}
        style={
          member.isAgent ? { color: member.agentInfo.nameColor } : undefined
        }
      >
        {name}
        {member.isSelf && (
          <span
            className="ml-1 text-[10px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            （我）
          </span>
        )}
      </span>
      <AgentTag agentInfo={member.agentInfo} size="sm" />
    </button>
  );
}
