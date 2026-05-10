import { useState } from "react";
import type { WorkspaceScanResult } from "@magic/shared-types";
import { DialogOverlay } from "../common/DialogOverlay.js";

interface BindFolderConfirmDialogProps {
  folderPath: string;
  scan: WorkspaceScanResult;
  /** Display name for the room/peer the folder will bind to. Used in
   *  the "manager 可访问" line so the user sees who specifically can
   *  read their files. */
  peerLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

/**
 * Spec 022 § 4.2 — final confirmation step before publishing the
 * Matrix state event. Heavy on copy that explicitly tells the user
 * "files stay on your machine" so the threat model is unambiguous.
 */
export function BindFolderConfirmDialog({
  folderPath,
  scan,
  peerLabel,
  onCancel,
  onConfirm,
}: BindFolderConfirmDialogProps) {
  const [understood, setUnderstood] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folderName =
    folderPath.split(/[\\/]/).filter(Boolean).pop() ?? folderPath;

  const handleConfirm = async () => {
    if (!understood || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "绑定失败");
      setSubmitting(false);
    }
  };

  return (
    <DialogOverlay onClose={submitting ? () => {} : onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[14px] border-[0.5px] border-[var(--border-default)] p-5"
        style={{
          background: "var(--bg-primary)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          animation: "fade-in-up 0.2s ease-out",
        }}
      >
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
          绑定本地文件夹到此对话？
        </h2>

        <div
          className="mt-3 rounded-lg p-3"
          style={{ background: "var(--bg-surface)" }}
        >
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--text-primary)]">
            <span aria-hidden>📁</span>
            <span className="truncate">{folderName}</span>
          </p>
          <p
            className="mt-0.5 break-all text-[10.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {folderPath}
          </p>
          <p
            className="mt-2 text-[11.5px]"
            style={{ color: "var(--text-secondary)" }}
          >
            扫描到 {scan.fileCount} 个文件 ({formatSize(scan.totalSize)})
            {scan.ignoredCount > 0 && (
              <>
                ，已自动忽略 {scan.ignoredCount} 项
              </>
            )}
            {scan.truncated && (
              <span style={{ color: "var(--color-warning)" }}>
                （文件数太多，仅扫描前 {scan.fileCount} 个）
              </span>
            )}
          </p>
        </div>

        <div className="mt-3 space-y-1.5 text-[11.5px] leading-relaxed">
          <p style={{ color: "var(--text-secondary)" }}>工作方式：</p>
          <Bullet>
            文件保留在你的电脑上，<strong>不上传到任何服务器</strong>
          </Bullet>
          <Bullet>
            <span className="font-medium">{peerLabel}</span> 看到清单后，可按需
            请求读取文件
          </Bullet>
          <Bullet>Magic 离线时无法访问文件</Bullet>
          <Bullet>
            读取记录会显示在工作区面板，你随时可以查看与解绑
          </Bullet>
        </div>

        <label
          className="mt-3 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--bg-surface)]"
        >
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            disabled={submitting}
            className="h-3.5 w-3.5 cursor-pointer accent-[var(--brand-purple)]"
          />
          <span className="text-[12px] text-[var(--text-primary)]">
            我理解上述说明
          </span>
        </label>

        {error && (
          <p
            className="mt-2 text-[11.5px]"
            style={{ color: "var(--color-danger)" }}
          >
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border-[0.5px] border-[var(--border-default)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!understood || submitting}
            className="rounded-md px-4 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
            style={{ background: "var(--gradient-button)" }}
          >
            {submitting ? "绑定中…" : "绑定"}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="flex items-start gap-1.5"
      style={{ color: "var(--text-primary)" }}
    >
      <span
        aria-hidden
        className="mt-0.5 shrink-0 text-[10px]"
        style={{ color: "var(--color-success)" }}
      >
        ✓
      </span>
      <span className="flex-1">{children}</span>
    </p>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
