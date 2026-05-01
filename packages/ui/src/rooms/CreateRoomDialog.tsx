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
      <div className="w-full max-w-sm rounded-xl bg-bg-secondary p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-text-normal">创建房间</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-text-normal">房间名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入房间名称"
              autoFocus
              disabled={isCreating}
              className="w-full rounded-lg border border-divider bg-bg-primary
                         px-3 py-2 text-sm text-text-normal placeholder-text-faint
                         focus:border-brand focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-text-normal">话题（可选）</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="房间话题描述"
              disabled={isCreating}
              className="w-full rounded-lg border border-divider bg-bg-primary
                         px-3 py-2 text-sm text-text-normal placeholder-text-faint
                         focus:border-brand focus:outline-none disabled:opacity-50"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-normal">
            <input
              type="checkbox"
              checked={encrypted}
              onChange={(e) => setEncrypted(e.target.checked)}
              disabled={isCreating}
              className="rounded border-divider bg-bg-primary text-brand
                         focus:ring-brand"
            />
            启用端到端加密
          </label>

          {error && <p className="text-sm text-red">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="rounded-lg px-3 py-1.5 text-sm text-text-muted
                         hover:text-text-normal transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium
                         text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
            >
              {isCreating ? "创建中…" : "创建"}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}
