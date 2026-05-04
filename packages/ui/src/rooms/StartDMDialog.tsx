import { useCallback, useState } from "react";
import { createDM, useRoomStore } from "@magic/matrix-client";
import { DialogOverlay } from "../common/DialogOverlay.js";
import { MemberSearch } from "./MemberSearch.js";

interface StartDMDialogProps {
  onClose: () => void;
  /** Pre-fill the recipient — used by the MemberPanel "start DM" entry. */
  initialUserId?: string;
}

// Spec 020 FIX-3 — start a 1:1 DM. Backed by `createDM` which
// reuses an existing joined DM room with the same peer if one
// already exists, so repeatedly clicking on a member doesn't pile
// up empty rooms.
export function StartDMDialog({ onClose, initialUserId }: StartDMDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialUserId ?? null,
  );
  // Default off — encryption setup on fresh DMs has been flaky
  // enough on some Tuwunel/Synapse builds that users have asked
  // for it to be opt-in.
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    if (!selectedUserId || isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const roomId = await createDM(selectedUserId, {
        encrypted: isEncrypted,
      });
      useRoomStore.getState().setActiveRoom(roomId);
      onClose();
    } catch (err) {
      setError((err as Error).message ?? "发起私聊失败");
    } finally {
      setIsCreating(false);
    }
  }, [selectedUserId, isEncrypted, isCreating, onClose]);

  return (
    <DialogOverlay onClose={isCreating ? () => {} : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl p-6 shadow-2xl"
        style={{
          background: "var(--bg-primary)",
          border: "0.5px solid var(--border-default)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          animation: "fade-in-up 0.2s ease-out",
        }}
      >
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          发起私聊
        </h2>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          搜索用户名或输入完整的 Matrix ID（如 @user:server.com）
        </p>

        <div className="mt-4">
          <MemberSearch
            selectedUserIds={selectedUserId ? [selectedUserId] : []}
            onSelect={(uid) => setSelectedUserId(uid)}
            onRemove={() => setSelectedUserId(null)}
            placeholder="搜索用户…"
          />
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isEncrypted}
            onChange={(e) => setIsEncrypted(e.target.checked)}
            disabled={isCreating}
            className="h-4 w-4 rounded accent-[var(--brand-purple)]"
          />
          <span className="text-xs text-[var(--text-secondary)]">
            启用端到端加密
          </span>
        </label>

        {error && (
          <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="rounded-lg px-4 py-2 text-sm transition-colors
                       hover:text-[var(--text-primary)] disabled:opacity-50"
            style={{ color: "var(--text-secondary)" }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={!selectedUserId || isCreating}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white
                       transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: "var(--gradient-button)" }}
          >
            {isCreating ? "创建中…" : "开始对话"}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
