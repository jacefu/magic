import { app } from "electron";
import type { IPCModule } from "./registry.js";

export function createAppHandlers(): IPCModule {
  return {
    handlers: {
      "app:get-version": () => app.getVersion(),
      "app:get-platform": () => process.platform,
    },
  };
}
