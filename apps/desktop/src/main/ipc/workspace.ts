import { dialog, type BrowserWindow } from "electron";
import type { IPCModule } from "./registry.js";
import type { WorkspaceManager } from "../workspace/WorkspaceManager.js";

/**
 * Spec 022 v3 § 5.1.1 — IPC surface for the workspace module.
 * Channel namespace `workspace:<verb>` matches the existing
 * `settings:get`, `matrix:login`, etc. convention.
 *
 * Renderer-side callers:
 *   - useWorkspaceBinding (binding lifecycle UI hook)
 *   - useMessageInterceptor (calls workspace:readFile when sending)
 */
export function createWorkspaceHandlers(
  workspace: WorkspaceManager,
): IPCModule {
  return {
    handlers: {
      "workspace:pickFolder": async (
        _payload: undefined,
        win: BrowserWindow,
      ) => {
        const result = await dialog.showOpenDialog(win, {
          properties: ["openDirectory", "createDirectory"],
          title: "选择要绑定的本地文件夹",
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
      },

      "workspace:scanFolder": (folderPath: string) =>
        workspace.scanFolder(folderPath),

      "workspace:bind": (
        roomId: string,
        folderPath: string,
        boundBy: string,
      ) => workspace.bind(roomId, folderPath, boundBy),

      "workspace:unbind": (roomId: string) => workspace.unbind(roomId),

      "workspace:getBinding": (roomId: string) =>
        workspace.getBinding(roomId),

      "workspace:getFileTree": (roomId: string) =>
        workspace.getFileTree(roomId),

      "workspace:revealInFinder": (roomId: string) => {
        workspace.revealInFinder(roomId);
      },

      // Spec §5.2.1 — useMessageInterceptor calls this for every
      // detected / explicitly-attached path right before sending.
      "workspace:readFile": (roomId: string, relPath: string) =>
        workspace.readFile(roomId, relPath),

      // Spec §3.6 — auto-attach toggle.
      "workspace:setAutoAttach": (roomId: string, enabled: boolean) => {
        workspace.setAutoAttach(roomId, enabled);
      },

      "workspace:getAutoAttach": (roomId: string) =>
        workspace.getAutoAttach(roomId),
    },
  };
}
