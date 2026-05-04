import { useCallback, useState, type FormEvent } from "react";
import { createRoom, useRoomStore } from "@magic/matrix-client";
import { DialogOverlay } from "../common/DialogOverlay.js";
import { MemberSearch } from "./MemberSearch.js";

interface CreateRoomDialogProps {
  onClose: () => void;
}

// Spec 020 FIX-7 + FIX-2 — centered modal with everything inline:
// name, topic, member invite, e2ee toggle. The previous version
// rendered as a half-width pop-out inside the room list rail and
// didn't allow inviting anyone, so creating a room produced a dead
// empty channel.
export function CreateRoomDialog({ onClose }: CreateRoomDialogProps) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  // Default off — same reasoning as StartDMDialog: e2ee bootstrap
  // can be flaky on fresh rooms, and users have asked for it to be
  // opt-in.
  const [encrypted, setEncrypted] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || isCreating) return;

      setIsCreating(true);
      setError(null);

      try {
        const roomId = await createRoom({
          name: trimmed,
          topic: topic.trim() || undefined,
          encrypted,
          invite: selectedUserIds,
        });
        // Switch to the new room so the user lands on a usable view.
        useRoomStore.getState().setActiveRoom(roomId);
        onClose();
      } catch (err) {
        setError((err as Error).message ?? "创建房间失败");
      } finally {
        setIsCreating(false);
      }
    },
    [name, topic, encrypted, selectedUserIds, isCreating, onClose],
  );

  const inputClasses =
    "w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors " +
    "focus:border-[var(--border-active)] disabled:opacity-50";
  const inputStyle: React.CSSProperties = {
    background: "var(--bg-surface)",
    border: "0.5px solid var(--border-default)",
    color: "var(--text-primary)",
  };

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
          创建房间
        </h2>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          创建一个新的聊天房间，邀请 Agent 或团队成员加入
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              房间名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入房间名称"
              autoFocus
              disabled={isCreating}
              className={inputClasses}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              话题（可选）
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="房间话题描述"
              disabled={isCreating}
              className={inputClasses}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              邀请成员（可选）
            </label>
            <MemberSearch
              selectedUserIds={selectedUserIds}
              onSelect={(uid) =>
                setSelectedUserIds((prev) =>
                  prev.includes(uid) ? prev : [...prev, uid],
                )
              }
              onRemove={(uid) =>
                setSelectedUserIds((prev) => prev.filter((id) => id !== uid))
              }
              placeholder="搜索用户名或输入 Matrix ID…"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={encrypted}
              onChange={(e) => setEncrypted(e.target.checked)}
              disabled={isCreating}
              className="h-4 w-4 rounded accent-[var(--brand-purple)]"
            />
            <span className="text-xs text-[var(--text-secondary)]">
              启用端到端加密
            </span>
          </label>

          {error && (
            <p className="text-xs text-[var(--color-danger)]">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
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
              type="submit"
              disabled={isCreating || !name.trim()}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white
                         transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--gradient-button)" }}
            >
              {isCreating ? "创建中…" : "创建"}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}
