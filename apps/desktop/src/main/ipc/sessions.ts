import type { PersistedSession } from "@magic/shared-types";
import { sessionsStore } from "../sessions-store.js";
import type { IPCModule } from "./registry.js";

export function createSessionsHandlers(): IPCModule {
  return {
    handlers: {
      "sessions:save": (sessions: PersistedSession[]): void => {
        sessionsStore.set("sessions", sessions);
      },
      "sessions:load": (): PersistedSession[] => {
        return sessionsStore.get("sessions");
      },
    },
  };
}
