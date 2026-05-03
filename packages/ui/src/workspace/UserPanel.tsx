import { useAuthStore, useUIStore } from "@magic/matrix-client";

/**
 * Bottom-of-sidebar user panel: avatar + display name + settings gear.
 * Logout / disconnect lives inside the settings page (Servers section)
 * now that the app supports multi-server sessions.
 */
export function UserPanel() {
  const userId = useAuthStore((s) => s.userId);
  const openSettings = useUIStore((s) => s.openSettings);

  const displayName =
    userId?.match(/^@([^:]+)/)?.[1] ?? userId ?? "用户";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="relative flex items-center gap-1.5 bg-[var(--bg-panel)] px-1.5 py-1.5">
      <div className="relative shrink-0">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ background: "var(--gradient-button)" }}
        >
          {initials}
        </div>
        <div className="absolute -bottom-px -right-px flex h-3 w-3 items-center justify-center rounded-full bg-[var(--bg-panel)]">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              background: "var(--color-success)",
              boxShadow: "var(--glow-success)",
            }}
          />
        </div>
      </div>

      <div className="min-w-0 flex-1 px-0.5">
        <p className="truncate text-[13px] font-semibold leading-tight text-[var(--text-primary)]">
          {displayName}
        </p>
        <p className="truncate text-[11px] leading-tight text-[var(--text-secondary)]">
          在线
        </p>
      </div>

      <div className="flex shrink-0 items-center">
        <button
          type="button"
          title="设置"
          onClick={openSettings}
          className="flex h-8 w-8 items-center justify-center rounded text-[#B5BAC1]
                     transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
        >
          <GearIcon />
        </button>
      </div>
    </div>
  );
}

function GearIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}
