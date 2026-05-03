import { useEffect } from "react";
import { useVerification } from "../hooks/useVerification.js";
import { VerificationEmojiGrid } from "./VerificationEmojiGrid.js";
import { DialogOverlay } from "../common/DialogOverlay.js";

interface DeviceVerificationDialogProps {
  userId: string;
  deviceId: string;
  onClose: () => void;
}

export function DeviceVerificationDialog({
  userId,
  deviceId,
  onClose,
}: DeviceVerificationDialogProps) {
  const { phase, sasData, error, requestVerification, confirmSas, rejectSas, reset } =
    useVerification();

  useEffect(() => {
    requestVerification(userId, deviceId);
  }, [userId, deviceId, requestVerification]);

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <DialogOverlay onClose={handleClose}>
      <div className="w-full max-w-md rounded-xl bg-[var(--bg-glass)] p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">设备验证</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">与 {deviceId} 进行安全验证</p>

        <div className="mt-6">
          {phase === "requested" && <PhaseRequested />}
          {phase === "ready" && <PhaseReady />}
          {phase === "showing-sas" && sasData && (
            <PhaseSas
              emoji={sasData.emoji}
              onConfirm={confirmSas}
              onReject={rejectSas}
            />
          )}
          {phase === "confirmed" && <PhaseConfirmed />}
          {phase === "done" && <PhaseDone onClose={handleClose} />}
          {(phase === "cancelled" || phase === "error") && (
            <PhaseError
              error={error}
              onRetry={() => requestVerification(userId, deviceId)}
              onClose={handleClose}
            />
          )}
        </div>
      </div>
    </DialogOverlay>
  );
}

function PhaseRequested() {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-purple)] border-t-transparent" />
      <p className="mt-4 text-sm text-[var(--text-primary)]">等待对方设备响应…</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">请在另一台设备上确认验证请求</p>
    </div>
  );
}

function PhaseReady() {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-purple)] border-t-transparent" />
      <p className="mt-4 text-sm text-[var(--text-primary)]">正在建立安全通道…</p>
    </div>
  );
}

function PhaseSas({
  emoji,
  onConfirm,
  onReject,
}: {
  emoji: Array<[string, string]>;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <div>
      <p className="text-center text-sm text-[var(--text-primary)]">
        请确认以下 emoji 与另一台设备上显示的完全一致：
      </p>
      <div className="my-6">
        <VerificationEmojiGrid emoji={emoji} />
      </div>
      <div className="flex gap-3">
        <button
          onClick={onReject}
          className="flex-1 rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm
                     text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-surface)]"
        >
          不一致
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-[var(--color-success)] px-4 py-2 text-sm font-medium
                     text-white transition-colors hover:bg-[var(--color-success)]/90"
        >
          一致，确认验证
        </button>
      </div>
    </div>
  );
}

function PhaseConfirmed() {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-success)] border-t-transparent" />
      <p className="mt-4 text-sm text-[var(--text-primary)]">正在完成验证…</p>
    </div>
  );
}

function PhaseDone({ onClose }: { onClose: () => void }) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success)]/20">
        <svg
          className="h-6 w-6 text-[var(--color-success)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="mt-4 text-sm font-medium text-[var(--color-success)]">验证成功</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">设备已通过安全验证</p>
      <button
        onClick={onClose}
        className="mt-4 rounded-lg bg-[var(--brand-purple)] px-6 py-2 text-sm font-medium
                   text-white transition-colors hover:opacity-90"
      >
        完成
      </button>
    </div>
  );
}

function PhaseError({
  error,
  onRetry,
  onClose,
}: {
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-danger)]/20">
        <svg
          className="h-6 w-6 text-[var(--color-danger)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <p className="mt-4 text-sm font-medium text-[var(--color-danger)]">验证失败</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{error ?? "未知错误"}</p>
      <div className="mt-4 flex justify-center gap-3">
        <button
          onClick={onClose}
          className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)]
                     transition-colors hover:bg-[var(--bg-surface)]"
        >
          关闭
        </button>
        <button
          onClick={onRetry}
          className="rounded-lg bg-[var(--brand-purple)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]
                     transition-colors hover:opacity-90"
        >
          重试
        </button>
      </div>
    </div>
  );
}
