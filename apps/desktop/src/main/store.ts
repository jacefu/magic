import Store from "electron-store";
import type { AppSettings } from "@magic/shared-types";

const defaults: AppSettings = {
  theme: "system",
  language: "zh",
  notifications: true,
  startMinimized: false,
  homeserver: "https://matrix.magic.com",
};

export const settingsStore = new Store<AppSettings>({
  name: "magic-settings",
  defaults,
});
