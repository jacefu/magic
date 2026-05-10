import { dialog, type BrowserWindow } from "electron";
import type { IPCModule } from "./registry.js";
import type { WorkspaceManager } from "../workspace/WorkspaceManager.js";

/**
 * Spec 022 § 5.1.1 — IPC surface for the workspace module. Channels
 * follow the `workspace:<verb>` convention (matches `settings:get`,
 * `matrix:login`, etc.).
 *
 * Renderer-side callers live in:
 *   - useWorkspaceBinding (the binding lifecycle UI hook)
 *   - useWorkspaceMatrixBridge (the read/list request dispatcher)
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

      "workspace:bind": (roomId: string, folderPath: string, boundBy: string) =>
        workspace.bind(roomId, folderPath, boundBy),

      "workspace:unbind": (roomId: string) => workspace.unbind(roomId),

      "workspace:getBinding": (roomId: string) =>
        workspace.getBinding(roomId),

      "workspace:getAllBindings": () => workspace.getAllBindings(),

      "workspace:revealInFinder": (roomId: string) => {
        workspace.revealInFinder(roomId);
      },

      "workspace:readFile": (
        roomId: string,
        relPath: string,
        maxSize: number,
        requesterId: string,
      ) => workspace.readFile(roomId, relPath, maxSize, requesterId),

      "workspace:listDir": (
        roomId: string,
        relPath: string,
        depth: number,
        requesterId: string,
      ) => workspace.listDir(roomId, relPath, depth, requesterId),

      "workspace:getAccessLog": (roomId: string, limit: number) =>
        workspace.getAccessLog(roomId, limit),
    },
  };
}
