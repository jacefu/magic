import { useCallback, useState } from "react";
import type { WorkspaceScanResult } from "@magic/shared-types";
import { useWorkspaceBinding } from "../hooks/useWorkspaceBinding.js";
import { BindFolderConfirmDialog } from "./BindFolderConfirmDialog.js";
import { isElectron } from "../hooks/useElectronAPI.js";

interface BindFolderButtonProps {
  roomId: string;
  /** Display label for the room/peer used in the confirm dialog
   *  ("manager 看到清单后…"). Falls back to a generic label if the
   *  caller doesn't know yet. */
  peerLabel?: string;
  /** When true, render only the icon (used inside the composer "+"
   *  menu). When false, render a full pill-shaped button (used inside
   *  WorkspaceSection's empty state). */
  variant?: "menu" | "pill";
  className?: string;
  onAfterBind?: () => void;
}

/**
 * Spec 022 § 4.1 — entry point that orchestrates the three-step bind
 * flow: native picker → folder scan → confirm dialog → publish.
 *
 * State only lives here while the dialog is open; once it closes, the
 * canonical store of truth is the WorkspaceManager (subscribed via
 * useWorkspaceBinding).
 */
export function BindFolderButton({
  roomId,
  peerLabel = "Agent",
  variant = "pill",
  className,
  onAfterBind,
}: BindFolderButtonProps) {
  const { bind } = useWorkspaceBinding(roomId);
  const [pending, setPending] = useState<{
    folderPath: string;
    scan: WorkspaceScanResult;
  } | null>(null);
  const [picking, setPicking] = useState(false);

  const startBindFlow = useCallback(async () => {
    if (!isElectron()) return;
    const api = window.electronAPI.workspace;
    if (!api || picking) return;
    setPicking(true);
    try {
      const folderPath = await api.pickFolder();
      if (!folderPath) return;
      const scan = await api.scanFolder(folderPath);
      setPending({ folderPath, scan });
    } catch (err) {
      console.error("[workspace] pick/scan failed:", err);
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
          <span>绑定本地文件夹</span>
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
          {picking ? "扫描中…" : "绑定文件夹"}
        </button>
      )}

      {pending && (
        <BindFolderConfirmDialog
          folderPath={pending.folderPath}
          scan={pending.scan}
          peerLabel={peerLabel}
          onCancel={() => setPending(null)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
