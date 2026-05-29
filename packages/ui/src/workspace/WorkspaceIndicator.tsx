import { useUIStore } from "@magic/matrix-client";
import { useWorkspaceBinding } from "../hooks/useWorkspaceBinding.js";
import { isElectron } from "../hooks/useElectronAPI.js";

interface WorkspaceIndicatorProps {
  roomId: string;
}

/**
 * Spec 022 v6 §7.2 — compact status pill in ChannelHeader that shows
 * the bound workspace name when one exists. Clicking it opens the
 * room settings panel where the full WorkspaceSection lives.
 *
 * Renders nothing when no binding exists or when running on web — we
 * don't want an empty placeholder cluttering the header. File counts
 * are no longer surfaced (v6 doesn't track them in the binding record
 * because the tree is scanned on demand).
 */
export function WorkspaceIndicator({ roomId }: WorkspaceIndicatorProps) {
  const { binding } = useWorkspaceBinding(roomId);
  const setRightPanel = useUIStore((s) => s.setRightPanel);

  if (!isElectron() || !binding) return null;

  return (
    <button
      type="button"
      onClick={() => setRightPanel("settings")}
      title={`已绑定本地工作区：${binding.localPath}`}
      className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors hover:bg-[var(--bg-surface)]"
      style={{ color: "var(--text-secondary)" }}
    >
      <span aria-hidden>📁</span>
      <span className="max-w-[120px] truncate">{binding.displayName}</span>
    </button>
  );
}
