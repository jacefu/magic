import { memo } from "react";
import type { RoomEncryptionStatus } from "@magic/matrix-client";

interface EncryptionBadgeProps {
  status: RoomEncryptionStatus;
  size?: "sm" | "md";
}

export const EncryptionBadge = memo(function EncryptionBadge({
  status,
  size = "sm",
}: EncryptionBadgeProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  switch (status) {
    case "verified":
      return (
        <span className="flex items-center gap-1" title="所有设备已验证">
          <ShieldCheckIcon className={`${iconSize} text-green-500`} />
          {size === "md" && <span className="text-xs text-green-500">已验证</span>}
        </span>
      );
    case "encrypted-unverified":
      return (
        <span className="flex items-center gap-1" title="已加密，部分设备未验证">
          <ShieldIcon className={`${iconSize} text-yellow-500`} />
          {size === "md" && <span className="text-xs text-yellow-500">部分验证</span>}
        </span>
      );
    case "unencrypted":
      return (
        <span className="flex items-center gap-1" title="未加密">
          <ShieldOffIcon className={`${iconSize} text-gray-500`} />
          {size === "md" && <span className="text-xs text-gray-500">未加密</span>}
        </span>
      );
    default:
      return null;
  }
});

function ShieldCheckIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zm3.28 5.78a.75.75 0 00-1.06-1.06L9 9.878 7.78 8.66a.75.75 0 00-1.06 1.06l1.75 1.75a.75.75 0 001.06 0l3.75-3.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ShieldIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 8a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ShieldOffIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286zm0 13.036h.008v.008H12v-.008z"
      />
    </svg>
  );
}
