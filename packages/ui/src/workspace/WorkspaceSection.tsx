import { useWorkspaceBinding } from "../hooks/useWorkspaceBinding.js";
import { SectionTitle } from "../settings/roomSettingsPrimitives.js";
import { BindFolderButton } from "./BindFolderButton.js";
import { isElectron } from "../hooks/useElectronAPI.js";

interface WorkspaceSectionProps {
  roomId: string;
  /** Pretty-name for the binding peer. Used inside the confirm dialog
   *  copy. Group rooms can pass the room name; DMs the peer display
   *  name. */
  peerLabel?: string;
}

/**
 * Spec 022 v3 §3.6 / §4.3 — settings-panel block for the workspace
 * binding. Shows the bound folder summary, reveal-in-Finder, unbind,
 * and (new in v3) the auto-attach toggle. The access log from v2 is
 * gone because v3 doesn't field read requests anymore.
 */
export function WorkspaceSection({
  roomId,
  peerLabel = "Agent",
}: WorkspaceSectionProps) {
  const { binding, loading, unbind, revealInFinder, setAutoAttach } =
    useWorkspaceBinding(roomId);

  if (!isElectron()) {
    return (
      <div>
        <SectionTitle>本地文件夹</SectionTitle>
        <p
          className="px-2 text-[10.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          仅桌面版支持绑定本地文件夹
        </p>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle>本地文件夹</SectionTitle>

      {loading ? (
        <p
          className="px-2 text-[11px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          加载中…
        </p>
      ) : !binding ? (
        <div className="space-y-2 px-2">
          <p
            className="text-[11.5px]"
            style={{ color: "var(--text-secondary)" }}
          >
            尚未绑定本地文件夹。绑定后当你的消息提到文件路径时，
            Magic 会自动把文件内容附到消息中发给 {peerLabel}。
          </p>
          <BindFolderButton roomId={roomId} peerLabel={peerLabel} />
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className="rounded-lg p-2.5"
            style={{ background: "var(--bg-surface)" }}
          >
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-primary)]">
              <span aria-hidden>📁</span>
              <span className="truncate">{binding.displayName}</span>
            </p>
            <p
              className="mt-0.5 break-all text-[10px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {binding.localPath}
            </p>
            <p
              className="mt-1.5 text-[10.5px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {binding.fileCount} 个文件 · {formatSize(binding.totalSize)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={revealInFinder}
                className="rounded-md border-[0.5px] border-[var(--border-default)] px-2.5 py-1 text-[10.5px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                在 Finder 中查看
              </button>
              <button
                type="button"
                onClick={() => void unbind()}
                className="rounded-md px-2.5 py-1 text-[10.5px] transition-colors hover:bg-[rgba(244,63,94,0.1)]"
                style={{ color: "var(--color-danger)" }}
              >
                解绑
              </button>
            </div>
          </div>

          {/* Spec §3.6 — auto-attach toggle. When off, only files
              picked through the 📁 button get attached. */}
          <label
            className="flex cursor-pointer items-center justify-between gap-2 rounded-lg p-2.5 transition-colors hover:bg-[var(--bg-hover)]"
            style={{ background: "var(--bg-surface)" }}
          >
            <span className="flex-1">
              <span
                className="text-[11.5px] font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                自动附加
              </span>
              <span
                className="mt-0.5 block text-[10px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                当我的消息提到 workspace 中的文件路径时，自动读取并附加文件内容
              </span>
            </span>
            <input
              type="checkbox"
              checked={binding.autoAttach}
              onChange={(e) => void setAutoAttach(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-[var(--brand-purple)]"
            />
          </label>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
