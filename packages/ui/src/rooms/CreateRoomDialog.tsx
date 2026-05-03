import { useState, type FormEvent } from "react";
import { createRoom } from "@magic/matrix-client";
import { DialogOverlay } from "../common/DialogOverlay.js";

interface CreateRoomDialogProps {
  onClose: () => void;
}

export function CreateRoomDialog({ onClose }: CreateRoomDialogProps) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [encrypted, setEncrypted] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      await createRoom({
        name: name.trim(),
        topic: topic.trim() || undefined,
        encrypted,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建房间失败");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <DialogOverlay onClose={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-[var(--bg-glass)] p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">创建房间</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-primary)]">房间名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入房间名称"
              autoFocus
              disabled={isCreating}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]
                         px-3 py-2 text-sm text-[var(--text-primary)] placeholder-text-faint
                         focus:border-[var(--brand-purple)] focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--text-primary)]">话题（可选）</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="房间话题描述"
              disabled={isCreating}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]
                         px-3 py-2 text-sm text-[var(--text-primary)] placeholder-text-faint
                         focus:border-[var(--brand-purple)] focus:outline-none disabled:opacity-50"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={encrypted}
              onChange={(e) => setEncrypted(e.target.checked)}
              disabled={isCreating}
              className="rounded border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--brand-purple)]
                         focus:ring-brand"
            />
            启用端到端加密
          </label>

          {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)]
                         hover:text-[var(--text-primary)] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="rounded-lg bg-[var(--brand-purple)] px-4 py-1.5 text-sm font-medium
                         text-white hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {isCreating ? "创建中…" : "创建"}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}
