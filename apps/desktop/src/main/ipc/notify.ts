import { Notification, type BrowserWindow } from "electron";
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
          silent: false,
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
    },
  };
}
