import { dialog, type BrowserWindow } from "electron";
import type { IPCModule } from "./registry.js";
import type { WorkspaceManager } from "../workspace/WorkspaceManager.js";

/**
 * Spec 022 v6 § 6.5 — IPC surface for the workspace context injector.
 *
 * Channel namespace `workspace:<verb>` matches the existing
 * `settings:get`, `matrix:login`, etc. convention.
 *
 * Renderer-side callers:
 *   - useWorkspaceInjection.sendWithContext (every user message)
 *   - useWorkspaceInjection effect           (file projection on path-mention)
 *   - WorkspaceSection / settings sections   (binding/global context editors)
 *   - BindFolderButton                       (bind / unbind / pick folder)
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
          title: "选择要绑定的本地工作区",
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
      },

      "workspace:bind": (
        roomId: string,
        folderPath: string,
        boundBy: string,
      ) => workspace.bind(roomId, folderPath, boundBy),

      "workspace:unbind": (roomId: string) => workspace.unbind(roomId),

      "workspace:getBinding": (roomId: string) =>
        workspace.getBinding(roomId),

      "workspace:scanTree": (roomId: string) => workspace.scanTree(roomId),

      "workspace:getSystemContext": (roomId: string) =>
        workspace.getSystemContext(roomId),

      "workspace:setBindingContext": (roomId: string, context: string) =>
        workspace.setBindingContext(roomId, context),

      "workspace:getGlobalContext": () => workspace.getGlobalContext(),

      "workspace:setGlobalContext": (text: string) =>
        workspace.setGlobalContext(text),

      "workspace:readFile": (roomId: string, relPath: string) =>
        workspace.readFile(roomId, relPath),

      "workspace:revealInFinder": (roomId: string) => {
        workspace.revealInFinder(roomId);
      },
    },
  };
}
