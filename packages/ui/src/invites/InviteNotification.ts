import {
  useNotificationStore,
  type RoomInvite,
} from "@magic/matrix-client";
import { isElectron } from "../hooks/useElectronAPI.js";
import { playMentionSound } from "../notifications/NotificationSound.js";

/**
 * Surface a desktop notification for a newly-arrived invite. Spec 018:
 * routed through the Electron native notifier when available, falling
 * back to the browser Notification API on web. Sound is optional and
 * uses the @-mention chime since invites are high-priority events.
 *
 * Caller-respected gating:
 *   - DND or `level === "mute"` → silent (no toast, no sound)
 *   - inviter blocked at the homeserver level wouldn't reach us; this
 *     just trusts the upstream filter
 */
export function evaluateInviteNotification(invite: RoomInvite): void {
  const notifStore = useNotificationStore.getState();
  if (notifStore.dnd) return;
  if (notifStore.level === "mute") return;

  const inviterName = invite.inviterName || invite.inviterId;
  const roomName = invite.roomName ?? "未命名房间";

  const title = invite.isDirect
    ? `${inviterName} 想与你私聊`
    : `${inviterName} 邀请你加入 ${roomName}`;
  const body = `来自 ${invite.inviterId}`;

  if (isElectron()) {
    const electronAPI = (
      window as unknown as {
        electronAPI?: {
          showNotification?: (payload: {
            title: string;
            body: string;
            roomId?: string;
          }) => void;
        };
      }
    ).electronAPI;
    electronAPI?.showNotification?.({
      title,
      body,
      roomId: invite.roomId,
    });
  } else if (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    const notif = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: `invite-${invite.roomId}`,
      silent: true,
    });
    notif.onclick = () => window.focus();
  }

  if (notifStore.soundEnabled) {
    playMentionSound();
  }
}
