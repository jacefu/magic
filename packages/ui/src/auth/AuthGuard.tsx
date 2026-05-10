import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  clearAllSessions,
  onRestoreProgress,
  restoreAllSessions,
  useSessionStore,
  type RestoreProgress,
} from "@magic/matrix-client";
import { WelcomePage } from "./WelcomePage.js";

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Watchdog ceiling — if `restoreAllSessions()` hasn't resolved by
 * this point we surface a "重置会话" escape hatch. The resolved
 * timeouts inside session-manager (initRustCrypto 15 s, network
 * paths their own caps) should always finish well below this; the
 * watchdog only fires for the truly pathological case (corrupt
 * store, missing WASM artefact, user toggling network mid-startup).
 */
const RESTORE_WATCHDOG_MS = 30_000;

/**
 * Multi-server-aware AuthGuard.
 *
 *   - On mount, fire `restoreAllSessions()` once to rehydrate every
 *     persisted session.
 *   - While restoring → boot screen with the MAGIC mark + spinner +
 *     a "正在恢复会话 (n/m)" progress label so users know how many
 *     servers are queued (Spec 017 BUG-4).
 *   - No sessions when restore finishes → WelcomePage.
 *   - Any session present → main UI (`children`).
 *
 * Each session manages its own MatrixClient instance via session-manager;
 * the active session's data is mirrored into the per-server stores
 * (roomStore, authStore, …) so existing components keep working.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const sessionCount = useSessionStore(
    (s) => Object.keys(s.sessions).length,
  );
  const [restored, setRestored] = useState(false);
  const [progress, setProgress] = useState<RestoreProgress | null>(null);
  const [stalled, setStalled] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    onRestoreProgress((p) => {
      if (!cancelled) setProgress(p);
    });
    restoreAllSessions().finally(() => {
      if (!cancelled) setRestored(true);
    });
    const watchdog = window.setTimeout(() => {
      if (!cancelled) setStalled(true);
    }, RESTORE_WATCHDOG_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      onRestoreProgress(null);
    };
  }, []);

  const handleReset = useCallback(async () => {
    if (resetting) return;
    setResetting(true);
    try {
      await clearAllSessions();
    } finally {
      // A reload is the simplest way to clear all in-memory state and
      // re-render from the WelcomePage cleanly.
      window.location.reload();
    }
  }, [resetting]);

  if (!restored) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="flex flex-col items-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] text-[28px] font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #6C5CE7, #00B4D8, #00F5A0)",
              backgroundSize: "200% 200%",
              animation: "gradient-shift 4s ease infinite",
            }}
          >
            M
          </div>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--brand-purple)] border-t-transparent" />
          {progress ? (
            <>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                正在恢复会话 ({progress.current}/{progress.total})
              </p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {progress.serverName}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">正在恢复会话…</p>
          )}

          {/* Always-visible escape hatch — even before the 30s
              watchdog, give the user a one-click way out. Splash
              that hangs forever is the most frustrating failure
              mode (Spec 022/023 had reports of stuck restore on
              corrupt local state); making the reset always reachable
              means no user can ever get permanently bricked. */}
          <div
            className="mt-6 max-w-xs text-center"
          >
            {stalled && (
              <p
                className="mb-2 text-[11px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                会话恢复花了比预期更长的时间。可能是本地缓存损坏 —
                清空后重新登录通常可以解决。
              </p>
            )}
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="rounded-md border-[0.5px] px-3 py-1 text-[10.5px] transition-colors disabled:opacity-50"
              style={{
                borderColor: stalled
                  ? "var(--color-danger)"
                  : "var(--border-default)",
                color: stalled
                  ? "var(--color-danger)"
                  : "var(--text-tertiary)",
              }}
              title="清空所有 Matrix 会话和本地缓存，回到登录界面"
            >
              {resetting ? "重置中…" : "卡住了？清空会话并重新登录"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (sessionCount === 0) {
    return <WelcomePage />;
  }

  return <>{children}</>;
}
