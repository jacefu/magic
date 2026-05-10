import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@magic/matrix-client";
import type { WorkspaceBinding } from "@magic/shared-types";

/**
 * Spec 022 — per-room view of the local-folder binding.
 *
 * Subscribes to main-process push events so the UI follows the source
 * of truth (file watcher republishes, manual unbinds from another
 * window, etc) rather than trying to keep its own copy in sync.
 *
 * Returns no-op operations (and `binding === null`) on the web build,
 * since the web app doesn't ship the WorkspaceManager.
 */
export interface UseWorkspaceBinding {
  binding: WorkspaceBinding | null;
  /** Initial fetch is in flight. Distinguish from "not bound" so the
   *  UI can show a quiet loading state instead of "尚未绑定". */
  loading: boolean;
  bind: (folderPath: string) => Promise<WorkspaceBinding>;
  unbind: () => Promise<void>;
  revealInFinder: () => void;
}

export function useWorkspaceBinding(roomId: string | null): UseWorkspaceBinding {
  const userId = useAuthStore((s) => s.userId);
  const [binding, setBinding] = useState<WorkspaceBinding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setBinding(null);
      setLoading(false);
      return;
    }
    const api =
      typeof window !== "undefined" ? window.electronAPI?.workspace : null;
    if (!api) {
      setBinding(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .getBinding(roomId)
      .then((b) => {
        if (!cancelled) {
          setBinding(b);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const unsub = api.onBindingChanged((payload) => {
      if (payload.roomId === roomId) {
        setBinding(payload.binding);
      }
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [roomId]);

  const bind = useCallback(
    async (folderPath: string): Promise<WorkspaceBinding> => {
      const api =
        typeof window !== "undefined" ? window.electronAPI?.workspace : null;
      if (!api || !roomId) {
        throw new Error("workspace API unavailable");
      }
      // boundBy is purely informational ("who in this client did the
      // binding") — the Matrix bridge stamps state events with the
      // SDK's own user id at publish time.
      const result = await api.bind(roomId, folderPath, userId ?? "");
      setBinding(result);
      return result;
    },
    [roomId, userId],
  );

  const unbind = useCallback(async () => {
    const api =
      typeof window !== "undefined" ? window.electronAPI?.workspace : null;
    if (!api || !roomId) return;
    await api.unbind(roomId);
    setBinding(null);
  }, [roomId]);

  const revealInFinder = useCallback(() => {
    const api =
      typeof window !== "undefined" ? window.electronAPI?.workspace : null;
    if (!api || !roomId) return;
    void api.revealInFinder(roomId);
  }, [roomId]);

  return { binding, loading, bind, unbind, revealInFinder };
}
