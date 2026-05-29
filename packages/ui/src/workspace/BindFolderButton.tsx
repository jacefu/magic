import { useCallback, useState } from "react";
import { useWorkspaceBinding } from "../hooks/useWorkspaceBinding.js";
import { BindFolderConfirmDialog } from "./BindFolderConfirmDialog.js";
import { isElectron } from "../hooks/useElectronAPI.js";

interface BindFolderButtonProps {
  roomId: string;
  /** Display label for the room/peer used in the confirm dialog copy.
   *  Falls back to a generic label if the caller doesn't know yet. */
  peerLabel?: string;
  /** When true, render only the icon (used inside the composer "+"
   *  menu). When false, render a full pill-shaped button (used inside
   *  WorkspaceSection's empty state). */
  variant?: "menu" | "pill";
  className?: string;
  onAfterBind?: () => void;
}

/**
 * Spec 022 v6 §7.1 — bind entry point. Two-step flow:
 *   1. Native folder picker
 *   2. Confirm dialog (no scan / no announcement message — bindings
 *      are App-local; nothing posts to the room)
 *
 * The actual injection lifecycle is owned by useWorkspaceInjection;
 * binding just registers the local-path ↔ roomId mapping and starts
 * a chokidar watcher so future scanTree() calls return live data.
 */
export function BindFolderButton({
  roomId,
  peerLabel = "Agent",
  variant = "pill",
  className,
  onAfterBind,
}: BindFolderButtonProps) {
  const { bind } = useWorkspaceBinding(roomId);
  const [pending, setPending] = useState<{ folderPath: string } | null>(null);
  const [picking, setPicking] = useState(false);

  const startBindFlow = useCallback(async () => {
    if (!isElectron()) return;
    const api = window.electronAPI.workspace;
    if (!api || picking) return;
    setPicking(true);
    try {
      const folderPath = await api.pickFolder();
      if (!folderPath) return;
      setPending({ folderPath });
    } catch (err) {
      console.error("[workspace] pick failed:", err);
    } finally {
      setPicking(false);
    }
  }, [picking]);

  const handleConfirm = useCallback(async () => {
    if (!pending) return;
    await bind(pending.folderPath);
    setPending(null);
    onAfterBind?.();
  }, [bind, pending, onAfterBind]);

  return (
    <>
      {variant === "menu" ? (
        <button
          type="button"
          onClick={startBindFlow}
          disabled={picking}
          className={
            className ??
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12.5px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-50"
          }
        >
          <span aria-hidden className="text-[14px]">
            📁
          </span>
          <span>绑定本地工作区</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={startBindFlow}
          disabled={picking}
          className={
            className ??
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
          }
          style={{ background: "var(--gradient-button)" }}
        >
          <span aria-hidden>📁</span>
          {picking ? "选择中…" : "绑定工作区"}
        </button>
      )}

      {pending && (
        <BindFolderConfirmDialog
          folderPath={pending.folderPath}
          peerLabel={peerLabel}
          onCancel={() => setPending(null)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
