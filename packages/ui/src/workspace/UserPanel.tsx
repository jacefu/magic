import { useAuthStore } from "@magic/matrix-client";
import { useAuth } from "../hooks/useAuth.js";

export function UserPanel() {
  const userId = useAuthStore((s) => s.userId);
  const { logout } = useAuth();

  const displayName = userId?.match(/^@([^:]+)/)?.[1] ?? userId ?? "用户";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-2 bg-bg-user-panel px-2 py-1.5">
      <div className="relative">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
          {initials}
        </div>
        <div className="absolute -bottom-px -right-px flex h-3 w-3 items-center justify-center rounded-full bg-bg-user-panel">
          <div className="h-[7px] w-[7px] rounded-full bg-green" />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-text-normal">{displayName}</p>
        <p className="text-[10px] text-text-muted">在线</p>
      </div>

      <button
        onClick={logout}
        title="登出"
        className="rounded p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-normal"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
          />
        </svg>
      </button>
    </div>
  );
}
