import { useEffect, useState, type ReactNode } from "react";
import {
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

  useEffect(() => {
    let cancelled = false;
    onRestoreProgress((p) => {
      if (!cancelled) setProgress(p);
    });
    restoreAllSessions().finally(() => {
      if (!cancelled) setRestored(true);
    });
    return () => {
      cancelled = true;
      onRestoreProgress(null);
    };
  }, []);

  if (!restored) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1E1F22]">
        <div className="flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2] text-[28px] font-semibold text-white">
            M
          </div>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#5865F2] border-t-transparent" />
          {progress ? (
            <>
              <p className="mt-3 text-sm text-[#949BA4]">
                正在恢复会话 ({progress.current}/{progress.total})
              </p>
              <p className="mt-1 text-xs text-[#6D6F78]">
                {progress.serverName}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-[#949BA4]">正在恢复会话…</p>
          )}
        </div>
      </div>
    );
  }

  if (sessionCount === 0) {
    return <WelcomePage />;
  }

  return <>{children}</>;
}
