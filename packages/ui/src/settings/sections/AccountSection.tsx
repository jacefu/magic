import { useSessionStore } from "@magic/matrix-client";

export function AccountSection() {
  const session = useSessionStore((s) => s.getActiveSession());

  if (!session) {
    return (
      <p className="text-sm text-[#949BA4]">未登录任何 Matrix 服务器。</p>
    );
  }

  const localpart = session.userId.match(/^@([^:]+)/)?.[1] ?? session.userId;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl bg-[#2B2D31] p-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
          style={{ backgroundColor: session.serverColor ?? "#5865F2" }}
        >
          {localpart.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[#DBDEE1]">
            {session.displayName ?? localpart}
          </p>
          <p className="truncate text-xs text-[#949BA4]">{session.userId}</p>
        </div>
      </div>

      <Field label="服务器">
        <span className="break-all">{session.homeserver}</span>
      </Field>
      <Field label="设备 ID">
        <code className="rounded bg-[#1E1F22] px-1.5 py-0.5 text-xs text-[#B5BAC1]">
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
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#949BA4]">
        {label}
      </p>
      <p className="text-sm text-[#DBDEE1]">{children}</p>
    </div>
  );
}
