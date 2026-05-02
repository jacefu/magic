import { useEffect } from "react";
import {
  registerNotificationCallback,
  useRoomStore,
} from "@magic/matrix-client";
import {
  evaluateNotification,
  recomputeAndPushTrayBadge,
} from "../notifications/NotificationService.js";
import { preloadSounds } from "../notifications/NotificationSound.js";
import { isElectron } from "./useElectronAPI.js";

/**
 * Initialise the notification system. Call once at the app root —
 *   - Preloads sound assets (silent fallback if missing).
 *   - Registers the bridge callback so every appended timeline event
 *     flows through `evaluateNotification`.
 *   - Asks for Web Notification permission on first run.
 *   - Wires Electron's `notify:clicked` IPC so clicking a native
 *     notification activates the corresponding room.
 *   - Pushes the tray badge whenever any room's unread count changes.
 */
export function useNotifications(): void {
  useEffect(() => {
    preloadSounds();
    registerNotificationCallback(evaluateNotification);

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      try {
        void Notification.requestPermission();
      } catch {
        /* silent */
      }
    }

    let cleanupNotifyClicked: (() => void) | null = null;
    if (isElectron()) {
      try {
        cleanupNotifyClicked =
          window.electronAPI.onNotifyClicked((data) => {
            if (data?.roomId) {
              useRoomStore.getState().setActiveRoom(data.roomId);
            }
          }) ?? null;
      } catch {
        /* silent */
      }
    }

    // Initial badge sync (in case rooms are already populated by the time
    // we mount — common for restored sessions).
    recomputeAndPushTrayBadge();

    // Subscribe to roomStore changes; recompute the badge whenever any
    // room's unread/highlight count changes.
    const unsubRooms = useRoomStore.subscribe((state, prev) => {
      if (state.rooms === prev.rooms) return;
      recomputeAndPushTrayBadge();
    });

    return () => {
      registerNotificationCallback(null);
      cleanupNotifyClicked?.();
      unsubRooms();
    };
  }, []);
}
