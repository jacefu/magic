interface UndecryptedMessageProps {
  reason?: string;
}

export function UndecryptedMessage({ reason }: UndecryptedMessageProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-yellow/40 bg-yellow/10 px-3 py-2">
      <LockIcon />
      <div>
        <p className="text-sm text-yellow">无法解密此消息</p>
        <p className="text-xs text-text-muted">
          {reason ?? "缺少解密密钥。请验证发送方设备或恢复密钥备份。"}
        </p>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-yellow"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}
