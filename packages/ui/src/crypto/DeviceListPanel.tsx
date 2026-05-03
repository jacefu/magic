import { useEffect, useState } from "react";
import {
  getOwnDevices,
  deleteDevice,
  useAuthStore,
  type DeviceInfo,
} from "@magic/matrix-client";
import { DeviceVerificationDialog } from "./DeviceVerificationDialog.js";

export function DeviceListPanel() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingDevice, setVerifyingDevice] = useState<string | null>(null);
  const userId = useAuthStore((s) => s.userId);

  const loadDevices = async () => {
    setLoading(true);
    const list = await getOwnDevices();
    setDevices(list);
    setLoading(false);
  };

  useEffect(() => {
    void loadDevices();
  }, []);

  const handleDelete = async (deviceId: string) => {
    if (!confirm(`确定要删除设备 ${deviceId} 吗？`)) return;
    try {
      await deleteDevice(deviceId);
      await loadDevices();
    } catch (err) {
      console.error("删除设备失败:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand-purple)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="px-1 text-sm font-semibold text-[var(--text-primary)]">
        我的设备 ({devices.length})
      </h3>

      {devices.map((device) => (
        <div
          key={device.deviceId}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
            device.isCurrentDevice
              ? "border border-[var(--brand-purple)]/20 bg-[var(--brand-purple)]/10"
              : "bg-[var(--bg-glass)]"
          }`}
        >
          <DeviceStatusIcon status={device.verificationStatus} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                {device.displayName}
              </p>
              {device.isCurrentDevice && (
                <span className="rounded bg-[var(--brand-purple)]/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-purple)]">
                  当前
                </span>
              )}
            </div>
            <p className="truncate text-xs text-[var(--text-secondary)]">
              {device.deviceId}
              {device.lastSeenTs && ` · 最后活跃 ${formatRelative(device.lastSeenTs)}`}
            </p>
          </div>

          {!device.isCurrentDevice && (
            <div className="flex gap-1">
              {device.verificationStatus !== "verified" && (
                <button
                  onClick={() => setVerifyingDevice(device.deviceId)}
                  className="rounded px-2 py-1 text-xs text-[var(--brand-purple)]
                             transition-colors hover:bg-[var(--brand-purple)]/10"
                >
                  验证
                </button>
              )}
              <button
                onClick={() => handleDelete(device.deviceId)}
                className="rounded px-2 py-1 text-xs text-[var(--color-danger)]
                           transition-colors hover:bg-[var(--color-danger)]/10"
                title="删除设备"
              >
                删除
              </button>
            </div>
          )}
        </div>
      ))}

      {verifyingDevice && userId && (
        <DeviceVerificationDialog
          userId={userId}
          deviceId={verifyingDevice}
          onClose={() => {
            setVerifyingDevice(null);
            void loadDevices();
          }}
        />
      )}
    </div>
  );
}

function DeviceStatusIcon({ status }: { status: DeviceInfo["verificationStatus"] }) {
  const colors: Record<DeviceInfo["verificationStatus"], string> = {
    verified: "text-[var(--color-success)]",
    "cross-signed": "text-[var(--color-success)]",
    unverified: "text-[var(--color-warning)]",
    unknown: "text-[var(--text-secondary)]",
  };

  return (
    <svg
      className={`h-5 w-5 shrink-0 ${colors[status]}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
      />
    </svg>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}
