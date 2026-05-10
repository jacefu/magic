import { useMemo } from "react";
import { useAuthStore } from "@magic/matrix-client";
import { useRoomMembers } from "../hooks/useRoomMembers.js";
import { RoomAvatar } from "../rooms/RoomAvatar.js";
import { AgentTag } from "../agents/AgentTag.js";
import type {
  NotificationMode,
  RoomSettings,
} from "../hooks/useRoomSettings.js";
import { NotificationSection } from "./NotificationSection.js";
import { SecuritySection } from "./SecuritySection.js";
import { AdvancedSection } from "./AdvancedSection.js";
import { SettingsDivider } from "./roomSettingsPrimitives.js";
import { WorkspaceSection } from "../workspace/WorkspaceSection.js";

interface DMSettingsPanelProps {
  roomId: string;
  settings: RoomSettings;
  readPersistedPrefs: () => { mode: NotificationMode; isFavourite: boolean };
  onSetNotification: (mode: NotificationMode) => Promise<void>;
  onToggleFavourite: () => Promise<void>;
  onLeave: () => Promise<void>;
}

// Spec 021 § 2.2 — DM settings is the trimmed version: peer info,
// notifications, security, advanced. No member management or info
// editing because there's only the two of you and the room
// metadata is auto-derived.
export function DMSettingsPanel({
  roomId,
  settings,
  readPersistedPrefs,
  onSetNotification,
  onToggleFavourite,
  onLeave,
}: DMSettingsPanelProps) {
  const myUserId = useAuthStore((s) => s.userId);
  const members = useRoomMembers(roomId);

  // The DM peer is whichever joined member isn't us. `useRoomMembers`
  // already excludes the current user, so the first entry is the
  // peer (if there is one).
  const peer = useMemo(() => members[0] ?? null, [members]);

  return (
    <div className="space-y-1 p-3">
      <div
        className="flex flex-col items-center gap-2 rounded-xl p-4"
        style={{ background: "var(--bg-surface)" }}
      >
        {peer ? (
          <>
            <RoomAvatar
              name={peer.displayName}
              avatarMxc={peer.avatarMxc}
              isDirect
              size={56}
            />
            <div className="flex items-center gap-1.5">
              <p
                className="text-sm font-semibold"
                style={
                  peer.isAgent
                    ? { color: peer.agentInfo.nameColor }
                    : { color: "var(--text-primary)" }
                }
              >
                {peer.displayName}
              </p>
              <AgentTag agentInfo={peer.agentInfo} size="md" />
            </div>
            <p
              className="text-[11px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {peer.userId}
            </p>
          </>
        ) : (
          <p
            className="text-xs"
            style={{ color: "var(--text-tertiary)" }}
          >
            等待对方加入…
          </p>
        )}
        {myUserId && peer && peer.userId === myUserId && (
          <p
            className="text-[10px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            （这是和你自己的对话）
          </p>
        )}
      </div>

      <SettingsDivider />

      <NotificationSection
        roomId={roomId}
        readPersistedPrefs={readPersistedPrefs}
        onSetMode={onSetNotification}
        onToggleFavourite={onToggleFavourite}
      />

      <SettingsDivider />

      <WorkspaceSection
        roomId={roomId}
        peerLabel={peer?.displayName ?? "对方"}
      />

      <SettingsDivider />

      <SecuritySection settings={settings} />

      <SettingsDivider />

      <AdvancedSection settings={settings} onLeave={onLeave} />
    </div>
  );
}
