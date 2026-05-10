import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@magic/matrix-client";
import type {
  WorkspaceBinding,
  WorkspaceFileEntry,
} from "@magic/shared-types";

/**
 * Spec 022 v3 §5.2.2 — per-room view of the local-folder binding +
 * cached file tree.
 *
 * Subscribes to the main-process `workspace:tree-changed` push so the
 * renderer always reflects the source of truth (watcher rescans,
 * unbinds from another window, etc.). Returns no-op operations on the
 * web build because the WorkspaceManager only ships in Electron.
 */
export interface UseWorkspaceBinding {
  binding: WorkspaceBinding | null;
  fileTree: WorkspaceFileEntry[];
  /** Initial fetch is in flight. Distinguishes "not bound" from
   *  "loading state" so the UI can stay quiet during the first
   *  mount. */
  loading: boolean;
  bind: (folderPath: string) => Promise<{
    binding: WorkspaceBinding;
    files: WorkspaceFileEntry[];
  }>;
  unbind: () => Promise<void>;
  revealInFinder: () => void;
  setAutoAttach: (enabled: boolean) => Promise<void>;
}

export function useWorkspaceBinding(
  roomId: string | null,
): UseWorkspaceBinding {
  const userId = useAuthStore((s) => s.userId);
  const [binding, setBinding] = useState<WorkspaceBinding | null>(null);
  const [fileTree, setFileTree] = useState<WorkspaceFileEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setBinding(null);
      setFileTree([]);
      setLoading(false);
      return;
    }
    const api =
      typeof window !== "undefined" ? window.electronAPI?.workspace : null;
    if (!api) {
      setBinding(null);
      setFileTree([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    Promise.all([api.getBinding(roomId), api.getFileTree(roomId)])
      .then(([b, t]) => {
        if (cancelled) return;
        setBinding(b);
        setFileTree(t ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const unsub = api.onTreeChanged((payload) => {
      if (payload.roomId !== roomId) return;
      setBinding(payload.binding);
      setFileTree(payload.files);
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
      setBinding(result.binding);
      setFileTree(result.files);
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
    setFileTree([]);
  }, [roomId]);

  const revealInFinder = useCallback(() => {
    const api =
      typeof window !== "undefined" ? window.electronAPI?.workspace : null;
    if (!api || !roomId) return;
    void api.revealInFinder(roomId);
  }, [roomId]);

  const setAutoAttach = useCallback(
    async (enabled: boolean) => {
      const api =
        typeof window !== "undefined" ? window.electronAPI?.workspace : null;
      if (!api || !roomId) return;
      await api.setAutoAttach(roomId, enabled);
      // Optimistic update — the tree-changed broadcast will refresh
      // the canonical state, but applying immediately makes the
      // toggle feel instant.
      setBinding((prev) => (prev ? { ...prev, autoAttach: enabled } : prev));
    },
    [roomId],
  );

  return {
    binding,
    fileTree,
    loading,
    bind,
    unbind,
    revealInFinder,
    setAutoAttach,
  };
}
