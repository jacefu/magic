import { useState } from "react";
import {
  acceptInvite,
  declineInvite,
  declineAndBlockInvite,
  useRoomStore,
  type RoomInvite,
} from "@magic/matrix-client";
import { DialogOverlay } from "../common/DialogOverlay.js";
import { RoomAvatar } from "../rooms/RoomAvatar.js";

interface InviteDialogProps {
  invite: RoomInvite;
  onClose: () => void;
}

type Action = "accept" | "decline" | "block";

export function InviteDialog({ invite, onClose }: InviteDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<Action | null>(null);

  const displayName =
    invite.roomName ?? (invite.isDirect ? invite.inviterName : "未命名房间");
  const inviterShortName =
    invite.inviterName ||
    invite.inviterId.match(/^@([^:]+)/)?.[1] ||
    invite.inviterId;

  const run = async (action: Action, fn: () => Promise<void>) => {
    setBusyAction(action);
    setError(null);
    try {
      await fn();
      if (action === "accept") {
        useRoomStore.getState().setActiveRoom(invite.roomId);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message ?? "操作失败");
      setBusyAction(null);
    }
  };

  const isBusy = busyAction !== null;

  return (
    <DialogOverlay onClose={isBusy ? () => {} : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-[rgba(15,15,21,0.95)] p-8 text-center shadow-2xl"
      >
        <h2 className="text-base font-semibold text-[rgba(255,255,255,0.85)]">
          {invite.isDirect
            ? `${inviterShortName} 想与你私聊`
            : `是否加入 ${displayName}？`}
        </h2>

        <div className="mt-4 flex justify-center">
          <RoomAvatar
            name={displayName}
            avatarMxc={invite.roomAvatarMxc}
            isDirect={invite.isDirect}
            size={48}
          />
        </div>

        <p className="mt-3 text-sm text-[rgba(255,255,255,0.4)]">
          邀请者{" "}
          <span className="font-semibold text-[rgba(255,255,255,0.85)]">
            {inviterShortName}
          </span>
        </p>
        <p className="text-xs text-[rgba(255,255,255,0.2)]">{invite.inviterId}</p>

        {invite.isEncrypted && (
          <p className="mt-2 text-xs text-[#00F5A0]">
            🔒 此房间已启用端到端加密
          </p>
        )}

        {error && <p className="mt-3 text-sm text-[#F43F5E]">{error}</p>}

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => run("accept", () => acceptInvite(invite.roomId))}
            disabled={isBusy}
            className="w-full rounded-lg py-2 text-sm font-medium text-white
                       transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #6C5CE7, #3B82F6)",
            }}
          >
            {busyAction === "accept" ? "加入中…" : "接受"}
          </button>

          <button
            type="button"
            onClick={() => run("decline", () => declineInvite(invite.roomId))}
            disabled={isBusy}
            className="w-full rounded-lg py-2 text-sm font-medium text-[rgba(255,255,255,0.85)]
                       transition-colors hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50"
          >
            {busyAction === "decline" ? "拒绝中…" : "拒绝"}
          </button>

          <button
            type="button"
            onClick={() =>
              run("block", () => declineAndBlockInvite(invite.roomId))
            }
            disabled={isBusy}
            className="w-full py-2 text-sm text-[#F43F5E] transition-colors
                       hover:underline disabled:opacity-50"
          >
            {busyAction === "block" ? "处理中…" : "拒绝并屏蔽"}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
