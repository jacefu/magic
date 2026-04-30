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
      <div className="w-full max-w-sm rounded-xl bg-magic-surface-alt p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">加入房间</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-gray-300">房间 ID 或别名</label>
            <input
              type="text"
              value={roomIdOrAlias}
              onChange={(e) => setRoomIdOrAlias(e.target.value)}
              placeholder="#room:magic.com 或 !abc:magic.com"
              autoFocus
              disabled={isJoining}
              className="w-full rounded-lg border border-gray-700 bg-magic-surface
                         px-3 py-2 text-sm text-white placeholder-gray-500
                         focus:border-magic-primary focus:outline-none disabled:opacity-50"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isJoining}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-400
                         hover:text-white transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isJoining || !roomIdOrAlias.trim()}
              className="rounded-lg bg-magic-primary px-4 py-1.5 text-sm font-medium
                         text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {isJoining ? "加入中…" : "加入"}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}
