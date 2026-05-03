import { useSessionStore } from "@magic/matrix-client";

export function AccountSection() {
  const session = useSessionStore((s) => s.getActiveSession());

  if (!session) {
    return (
      <p className="text-sm text-[rgba(255,255,255,0.4)]">未登录任何 Matrix 服务器。</p>
    );
  }

  const localpart = session.userId.match(/^@([^:]+)/)?.[1] ?? session.userId;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl bg-[rgba(18,18,26,0.85)] p-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
          style={{ backgroundColor: session.serverColor ?? "#5865F2" }}
        >
          {localpart.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[rgba(255,255,255,0.85)]">
            {session.displayName ?? localpart}
          </p>
          <p className="truncate text-xs text-[rgba(255,255,255,0.4)]">{session.userId}</p>
        </div>
      </div>

      <Field label="服务器">
        <span className="break-all">{session.homeserver}</span>
      </Field>
      <Field label="设备 ID">
        <code className="rounded bg-[rgba(12,12,18,0.95)] px-1.5 py-0.5 text-xs text-[#B5BAC1]">
          {session.deviceId}
        </code>
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
        {label}
      </p>
      <p className="text-sm text-[rgba(255,255,255,0.85)]">{children}</p>
    </div>
  );
}
