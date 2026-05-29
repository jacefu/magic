import { useEffect, useState } from "react";
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
 * Spec 022 v6 §7.2 — room-settings block for the bound workspace.
 * Replaces the v3 auto-attach toggle with a project-context editor:
 * users describe the project once and that text rides along with
 * every future message in this room.
 */
export function WorkspaceSection({
  roomId,
  peerLabel = "Agent",
}: WorkspaceSectionProps) {
  const { binding, loading, unbind, revealInFinder, setBindingContext } =
    useWorkspaceBinding(roomId);

  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset the editor draft whenever the binding underneath changes
  // (room switch, context edit from another window).
  useEffect(() => {
    setDraft(binding?.context ?? "");
    setSaved(false);
  }, [binding?.roomId, binding?.context]);

  if (!isElectron()) {
    return (
      <div>
        <SectionTitle>本地工作区</SectionTitle>
        <p
          className="px-2 text-[10.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          仅桌面版支持绑定本地工作区
        </p>
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await setBindingContext(draft);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const dirty = draft !== (binding?.context ?? "");

  return (
    <div>
      <SectionTitle>本地工作区</SectionTitle>

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
            尚未绑定本地工作区。绑定后，你的每条消息都会自动附带目录结构 +
            项目说明给 {peerLabel}，{peerLabel} 提到文件路径时还会自动把文件内容投回会话。
          </p>
          <BindFolderButton roomId={roomId} peerLabel={peerLabel} />
        </div>
      ) : (
        <div className="space-y-3">
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

          {/* Per-binding context — saved into the workspaces.json record
              under this binding, never written into the user's folder. */}
          <div className="space-y-1.5">
            <label
              className="block text-[11.5px] font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              项目说明（仅此绑定）
            </label>
            <p
              className="text-[10.5px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              在这里说明项目用途、技术栈、风格偏好等。会作为系统提示词的一部分附带给
              {" "}{peerLabel}，最多 8KB。
            </p>
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setSaved(false);
              }}
              maxLength={8 * 1024}
              rows={5}
              placeholder="例如：Flask 后端项目，认证用 JWT，遵循 PEP8，legacy/ 目录不要改"
              className="w-full resize-y rounded-md px-2.5 py-2 text-[12px] outline-none transition-colors focus:border-[var(--border-active)]"
              style={{
                background: "var(--bg-surface)",
                border: "0.5px solid var(--border-default)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-sans)",
                minHeight: 96,
              }}
            />
            <div className="flex items-center justify-between">
              <span
                className="text-[10px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {draft.length} / {8 * 1024} 字符
                {saved && !dirty && (
                  <span
                    className="ml-2"
                    style={{ color: "var(--color-success)" }}
                  >
                    已保存
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saving}
                className="rounded-md px-3 py-1 text-[11px] font-medium text-white transition-opacity disabled:opacity-40"
                style={{ background: "var(--gradient-button)" }}
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
