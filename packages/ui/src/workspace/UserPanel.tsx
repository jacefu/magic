import { useCallback, useState } from "react";
import {
  removeServer,
  useAuthStore,
  useSessionStore,
  useUIStore,
} from "@magic/matrix-client";
import { LetterAvatar } from "../avatar/LetterAvatar.js";

/**
 * Bottom-of-sidebar user panel: avatar + display name + settings gear
 * + sign-out button.
 *
 * "Sign out" used to live three menus deep under Settings → Servers →
 * Disconnect, which left users hunting for a way out. The dedicated
 * icon button at this level keeps a single click between the user and
 * the welcome screen.
 *
 * Spec 023 — the avatar follows the same letter-PNG default as every
 * other avatar in the app. The current user is always a human, so
 * `isAgent={false}` is hard-wired (matters only for digit-prefixed
 * userIds, which fall back to 'H').
 */
export function UserPanel() {
  const userId = useAuthStore((s) => s.userId);
  const openSettings = useUIStore((s) => s.openSettings);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const activeSession = useSessionStore((s) =>
    s.activeSessionId ? s.sessions[s.activeSessionId] : null,
  );
  const [signingOut, setSigningOut] = useState(false);

  const displayName =
    userId?.match(/^@([^:]+)/)?.[1] ?? userId ?? "用户";

  const handleSignOut = useCallback(async () => {
    if (!activeSessionId || signingOut) return;
    const label = activeSession?.serverName ?? activeSession?.homeserver ?? "";
    const ok = window.confirm(
      label
        ? `确定要退出登录 ${label} 吗？`
        : "确定要退出登录吗？",
    );
    if (!ok) return;
    setSigningOut(true);
    try {
      await removeServer(activeSessionId);
    } finally {
      setSigningOut(false);
    }
  }, [activeSessionId, activeSession, signingOut]);

  return (
    <div className="relative flex items-center gap-1.5 bg-[var(--bg-panel)] px-1.5 py-1.5">
      <div className="relative shrink-0">
        <LetterAvatar
          name={displayName}
          userId={userId ?? undefined}
          isAgent={false}
          size={32}
        />
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
          className="flex h-8 w-8 items-center justify-center rounded text-[var(--text-secondary)]
                     transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
        >
          <GearIcon />
        </button>
        {activeSessionId && (
          <button
            type="button"
            title={
              activeSession
                ? `退出登录 ${activeSession.serverName ?? activeSession.homeserver}`
                : "退出登录"
            }
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex h-8 w-8 items-center justify-center rounded text-[var(--text-secondary)]
                       transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--color-danger)]
                       disabled:opacity-40"
          >
            <SignOutIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function SignOutIcon() {
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
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
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
