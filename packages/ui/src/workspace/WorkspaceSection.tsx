import { useWorkspaceBinding } from "../hooks/useWorkspaceBinding.js";
import { SectionTitle } from "../settings/roomSettingsPrimitives.js";
import { BindFolderButton } from "./BindFolderButton.js";
import { AccessLogSection } from "./AccessLogSection.js";
import { isElectron } from "../hooks/useElectronAPI.js";

interface WorkspaceSectionProps {
  roomId: string;
  /** Pretty-name for the binding peer. Used inside the confirm dialog
   *  ("manager 看到清单后…") so the user sees who specifically can
   *  request files. Group rooms can pass the room name; DMs the peer
   *  display name. */
  peerLabel?: string;
}

/**
 * Spec 022 § 4.3 — settings-panel block that surfaces the room's
 * folder binding state, the bind/unbind controls, and the recent
 * access log. Renders nothing on the web build (the WorkspaceManager
 * lives in Electron's main process).
 */
export function WorkspaceSection({
  roomId,
  peerLabel = "Agent",
}: WorkspaceSectionProps) {
  const { binding, loading, unbind, revealInFinder } =
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
            尚未绑定本地文件夹。绑定后 {peerLabel} 可按需读取文件，
            文件不会上传到服务器。
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

          <div className="px-1">
            <p
              className="mb-1 text-[10px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              最近访问
            </p>
            <AccessLogSection roomId={roomId} />
          </div>
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
