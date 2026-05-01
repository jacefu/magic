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
      <div className="w-full max-w-md rounded-xl bg-magic-surface-alt p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">设备验证</h2>
        <p className="mt-1 text-sm text-gray-400">与 {deviceId} 进行安全验证</p>

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
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
      <p className="mt-4 text-sm text-gray-300">等待对方设备响应…</p>
      <p className="mt-1 text-xs text-gray-500">请在另一台设备上确认验证请求</p>
    </div>
  );
}

function PhaseReady() {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
      <p className="mt-4 text-sm text-gray-300">正在建立安全通道…</p>
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
      <p className="text-center text-sm text-gray-300">
        请确认以下 emoji 与另一台设备上显示的完全一致：
      </p>
      <div className="my-6">
        <VerificationEmojiGrid emoji={emoji} />
      </div>
      <div className="flex gap-3">
        <button
          onClick={onReject}
          className="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-sm
                     text-gray-300 transition-colors hover:bg-gray-700"
        >
          不一致
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium
                     text-white transition-colors hover:bg-green-700"
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
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
      <p className="mt-4 text-sm text-gray-300">正在完成验证…</p>
    </div>
  );
}

function PhaseDone({ onClose }: { onClose: () => void }) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-600/20">
        <svg
          className="h-6 w-6 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="mt-4 text-sm font-medium text-green-400">验证成功</p>
      <p className="mt-1 text-xs text-gray-500">设备已通过安全验证</p>
      <button
        onClick={onClose}
        className="mt-4 rounded-lg bg-magic-primary px-6 py-2 text-sm font-medium
                   text-white transition-colors hover:bg-blue-600"
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
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-600/20">
        <svg
          className="h-6 w-6 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <p className="mt-4 text-sm font-medium text-red-400">验证失败</p>
      <p className="mt-1 text-xs text-gray-500">{error ?? "未知错误"}</p>
      <div className="mt-4 flex justify-center gap-3">
        <button
          onClick={onClose}
          className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300
                     transition-colors hover:bg-gray-700"
        >
          关闭
        </button>
        <button
          onClick={onRetry}
          className="rounded-lg bg-magic-primary px-4 py-2 text-sm font-medium text-white
                     transition-colors hover:bg-blue-600"
        >
          重试
        </button>
      </div>
    </div>
  );
}
