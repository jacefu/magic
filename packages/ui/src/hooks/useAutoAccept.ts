import { useEffect } from "react";
import {
  acceptInvite,
  registerInviteNotificationCallback,
  type RoomInvite,
} from "@magic/matrix-client";
import { getAgentInfo } from "../lib/agentDetection.js";
import { evaluateInviteNotification } from "../invites/InviteNotification.js";

/**
 * Spec 018: route incoming invites through the auto-accept policy.
 *
 *   - Manager-issued invites (HiClaw orchestration) are joined
 *     automatically when `autoAcceptManager` is true so users don't
 *     have to manually approve every Worker workspace.
 *   - Everything else triggers a desktop notification + sound; the
 *     user clicks the invite item in RoomList to decide.
 *
 * Mount once at the top of the app tree. The callback registration is
 * a singleton in matrix-client/bridge — calling this twice would have
 * the second registration overwrite the first.
 */
export function useAutoAccept(autoAcceptManager: boolean = true): void {
  useEffect(() => {
    registerInviteNotificationCallback((invite: RoomInvite) => {
      const agentInfo = getAgentInfo(invite.inviterId);

      if (
        autoAcceptManager &&
        agentInfo.isAgent &&
        agentInfo.role === "manager"
      ) {
        acceptInvite(invite.roomId).catch((err) => {
          console.error(
            "自动接受 Manager 邀请失败:",
            (err as Error).message,
          );
        });
        return;
      }

      evaluateInviteNotification(invite);
    });

    return () => {
      registerInviteNotificationCallback(null);
    };
  }, [autoAcceptManager]);
}
