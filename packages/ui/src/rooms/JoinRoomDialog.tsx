import { useState, type FormEvent } from "react";
import { joinRoom } from "@magic/matrix-client";
import { DialogOverlay } from "../common/DialogOverlay.js";

interface JoinRoomDialogProps {
  onClose: () => void;
}

export function JoinRoomDialog({ onClose }: JoinRoomDialogProps) {
  const [roomIdOrAlias, setRoomIdOrAlias] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!roomIdOrAlias.trim()) return;

    setIsJoining(true);
    setError(null);

    try {
      await joinRoom(roomIdOrAlias.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "加入房间失败");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-[var(--bg-glass)] p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">加入房间</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-primary)]">房间 ID 或别名</label>
            <input
              type="text"
              value={roomIdOrAlias}
              onChange={(e) => setRoomIdOrAlias(e.target.value)}
              placeholder="#room:magic.com 或 !abc:magic.com"
              autoFocus
              disabled={isJoining}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]
                         px-3 py-2 text-sm text-[var(--text-primary)] placeholder-text-faint
                         focus:border-[var(--brand-purple)] focus:outline-none disabled:opacity-50"
            />
          </div>

          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isJoining}
              className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)]
                         hover:text-[var(--text-primary)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isJoining || !roomIdOrAlias.trim()}
              className="rounded-lg bg-[var(--brand-purple)] px-4 py-1.5 text-sm font-medium
                         text-white hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {isJoining ? "加入中…" : "加入"}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}
