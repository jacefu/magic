import { app, Notification, type BrowserWindow } from "electron";
import type { IPCModule } from "./registry.js";
import type { NotifyPayload } from "@magic/shared-types";

export function createNotifyHandlers(): IPCModule {
  return {
    handlers: {
      "notify:show": (payload: NotifyPayload, ...rest: any[]) => {
        const win = rest[rest.length - 1] as BrowserWindow;

        if (!Notification.isSupported()) return;

        const notification = new Notification({
          title: payload.title,
          body: payload.body,
          icon: payload.icon,
          // Sound is driven by the renderer's NotificationSound module so
          // the @mention vs. normal-message cue can differ. The native
          // notification stays silent.
          silent: true,
        });

        notification.on("click", () => {
          win.show();
          win.focus();
          win.webContents.send("notify:clicked", {
            roomId: payload.roomId,
            eventId: payload.eventId,
          });
        });

        notification.show();
      },

      // 015 — total unread count drives the macOS Dock badge / Linux
      // tray title. Windows uses the window's overlay icon, which we
      // skip here for now; tray title is a sane cross-platform fallback.
      "notify:set-badge": (count: number) => {
        if (process.platform === "darwin" && app.dock) {
          app.dock.setBadge(count > 0 ? String(count) : "");
        }
      },
    },
  };
}
