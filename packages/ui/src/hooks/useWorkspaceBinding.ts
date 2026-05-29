import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@magic/matrix-client";
import type { WorkspaceBinding } from "@magic/shared-types";

/**
 * Spec 022 v6 §6.5 — per-room view of the local-folder binding.
 *
 * Subscribes to the main-process `workspace:change` push so the
 * renderer always reflects the source of truth (bind, unbind,
 * watcher-driven tree refresh, or context edit from another window).
 * Returns no-op operations on the web build because the
 * WorkspaceManager only ships in Electron.
 *
 * Note: v6 dropped the in-memory file tree from this hook — the
 * useWorkspaceInjection hook scans on demand. UI surfaces that
 * still want a tree (e.g. settings panel previews) can call
 * `window.electronAPI.workspace.scanTree(roomId)` directly.
 */
export interface UseWorkspaceBinding {
  binding: WorkspaceBinding | null;
  /** Initial fetch is in flight. Distinguishes "not bound" from
   *  "loading state" so the UI can stay quiet during the first
   *  mount. */
  loading: boolean;
  bind: (folderPath: string) => Promise<WorkspaceBinding>;
  unbind: () => Promise<void>;
  revealInFinder: () => void;
  setBindingContext: (context: string) => Promise<void>;
}

export function useWorkspaceBinding(
  roomId: string | null,
): UseWorkspaceBinding {
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
        if (cancelled) return;
        setBinding(b);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const unsub = api.onChange((payload) => {
      if (payload.roomId !== roomId) return;
      setBinding(payload.binding);
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [roomId]);

  const bind = useCallback(
    async (folderPath: string) => {
      const api =
        typeof window !== "undefined" ? window.electronAPI?.workspace : null;
      if (!api || !roomId) {
        throw new Error("workspace API unavailable");
      }
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

  const setBindingContext = useCallback(
    async (context: string) => {
      const api =
        typeof window !== "undefined" ? window.electronAPI?.workspace : null;
      if (!api || !roomId) return;
      const updated = await api.setBindingContext(roomId, context);
      if (updated) setBinding(updated);
    },
    [roomId],
  );

  return {
    binding,
    loading,
    bind,
    unbind,
    revealInFinder,
    setBindingContext,
  };
}
