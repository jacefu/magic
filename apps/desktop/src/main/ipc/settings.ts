import { settingsStore } from "../store.js";
import type { AppSettings } from "@magic/shared-types";
import type { IPCModule } from "./registry.js";

export function createSettingsHandlers(): IPCModule {
  return {
    handlers: {
      "settings:get": (): AppSettings => {
        return settingsStore.store;
      },
      "settings:set": (key: string, value: unknown) => {
        settingsStore.set(key as keyof AppSettings, value as any);
      },
      "settings:get-value": (key: string) => {
        return settingsStore.get(key as keyof AppSettings);
      },
    },
  };
}
