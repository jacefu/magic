import { useCallback, useState } from "react";
import { useRoomMembers, type RoomMember } from "../hooks/useRoomMembers.js";
import type { RoomSettings } from "../hooks/useRoomSettings.js";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import { MemberSearch } from "../rooms/MemberSearch.js";
import { AgentTag } from "../agents/AgentTag.js";
import { SectionTitle } from "./roomSettingsPrimitives.js";

interface MemberManageSectionProps {
  roomId: string;
  settings: RoomSettings;
  onInvite: (userId: string) => Promise<void>;
  onKick: (userId: string, reason?: string) => Promise<void>;
}

export function MemberManageSection({
  roomId,
  settings,
  onInvite,
  onKick,
}: MemberManageSectionProps) {
  const members = useRoomMembers(roomId);
  const [showInvite, setShowInvite] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const handleInvite = useCallback(
    async (uid: string) => {
      setError(null);
      try {
        await onInvite(uid);
        setPendingInvite((p) => p.filter((x) => x !== uid));
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [onInvite],
  );

  const handleKick = useCallback(
    async (uid: string) => {
      setBusyUserId(uid);
      setError(null);
      try {
        await onKick(uid);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusyUserId(null);
      }
    },
    [onKick],
  );

  return (
    <div>
      <SectionTitle>成员（{members.length}）</SectionTitle>

      {showInvite && settings.canInvite && (
        <div className="mb-2 px-1">
          <MemberSearch
            selectedUserIds={pendingInvite}
            onSelect={(uid) => {
              setPendingInvite((p) => (p.includes(uid) ? p : [...p, uid]));
              void handleInvite(uid);
            }}
            onRemove={(uid) =>
              setPendingInvite((p) => p.filter((x) => x !== uid))
            }
            placeholder="搜索用户名或输入 Matrix ID…"
            showSelectedChips={false}
          />
        </div>
      )}

      {settings.canInvite && (
        <button
          type="button"
          onClick={() => setShowInvite((v) => !v)}
          className="mb-2 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-[var(--bg-surface)]"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>{showInvite ? "收起邀请" : "+ 邀请成员"}</span>
        </button>
      )}

      <div className="space-y-px">
        {members.map((m) => (
          <MemberRow
            key={m.userId}
            member={m}
            canKick={settings.canKick && m.userId !== ""}
            isBusy={busyUserId === m.userId}
            onKick={() => void handleKick(m.userId)}
          />
        ))}
      </div>

      {error && (
        <p
          className="mt-2 px-2 text-[10px]"
          style={{ color: "var(--color-danger)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function MemberRow({
  member,
  canKick,
  isBusy,
  onKick,
}: {
  member: RoomMember;
  canKick: boolean;
  isBusy: boolean;
  onKick: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--bg-surface)]">
      <RoomAvatar
        name={member.displayName}
        avatarMxc={member.avatarMxc}
        isDirect
        size={24}
      />
      <span
        className="flex-1 truncate text-[12px]"
        style={
          member.isAgent
            ? { color: member.agentInfo.nameColor }
            : { color: "var(--text-primary)" }
        }
      >
        {member.displayName}
      </span>
      <AgentTag agentInfo={member.agentInfo} size="sm" />
      {canKick && (
        <button
          type="button"
          onClick={onKick}
          disabled={isBusy}
          title="移除成员"
          className="invisible shrink-0 rounded px-1.5 py-0.5 text-[10px] transition-colors group-hover:visible disabled:opacity-50"
          style={{ color: "var(--color-danger)" }}
        >
          {isBusy ? "…" : "移除"}
        </button>
      )}
    </div>
  );
}
