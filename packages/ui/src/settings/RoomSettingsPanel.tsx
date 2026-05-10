import { useRoomSettings } from "../hooks/useRoomSettings.js";
import { RoomInfoSection } from "./RoomInfoSection.js";
import { MemberManageSection } from "./MemberManageSection.js";
import { NotificationSection } from "./NotificationSection.js";
import { SecuritySection } from "./SecuritySection.js";
import { AdvancedSection } from "./AdvancedSection.js";
import { DMSettingsPanel } from "./DMSettingsPanel.js";
import { SettingsDivider } from "./roomSettingsPrimitives.js";
import { WorkspaceSection } from "../workspace/WorkspaceSection.js";

interface RoomSettingsPanelProps {
  roomId: string;
}

/**
 * Spec 021 — top-level settings panel rendered into the right rail
 * when `rightPanelMode === "settings"`. Routes to the trimmed DM
 * variant for 1:1 rooms (which collapses room info / member
 * management into a peer card) and the full layout for group rooms.
 */
export function RoomSettingsPanel({ roomId }: RoomSettingsPanelProps) {
  const {
    settings,
    isSaving,
    error,
    setRoomName,
    setRoomTopic,
    inviteMember,
    kickMember,
    leaveRoom,
    setNotificationMode,
    toggleFavourite,
    readPersistedPrefs,
  } = useRoomSettings(roomId);

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <p
          className="text-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          加载中…
        </p>
      </div>
    );
  }

  if (settings.isDirect) {
    return (
      <DMSettingsPanel
        roomId={roomId}
        settings={settings}
        readPersistedPrefs={readPersistedPrefs}
        onSetNotification={setNotificationMode}
        onToggleFavourite={toggleFavourite}
        onLeave={leaveRoom}
      />
    );
  }

  return (
    <div className="space-y-1 p-3">
      <RoomInfoSection
        settings={settings}
        isSaving={isSaving}
        error={error}
        onSetName={setRoomName}
        onSetTopic={setRoomTopic}
      />

      <SettingsDivider />

      <MemberManageSection
        roomId={roomId}
        settings={settings}
        onInvite={inviteMember}
        onKick={kickMember}
      />

      <SettingsDivider />

      <NotificationSection
        roomId={roomId}
        readPersistedPrefs={readPersistedPrefs}
        onSetMode={setNotificationMode}
        onToggleFavourite={toggleFavourite}
      />

      <SettingsDivider />

      <WorkspaceSection
        roomId={roomId}
        peerLabel={settings.name || "房间成员"}
      />

      <SettingsDivider />

      <SecuritySection settings={settings} />

      <SettingsDivider />

      <AdvancedSection settings={settings} onLeave={leaveRoom} />
    </div>
  );
}
