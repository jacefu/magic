import { useState, useCallback, useEffect, useRef } from "react";
import { uploadAndSendFile } from "@magic/matrix-client";

export interface UploadTask {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "done" | "error" | "cancelled";
  error?: string;
}

export function useFileUpload(roomId: string) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const tasksRef = useRef<UploadTask[]>([]);
  const cancelledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const addFiles = useCallback((files: File[]) => {
    const newTasks: UploadTask[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      progress: 0,
      status: "pending",
    }));
    setTasks((prev) => {
      const next = [...prev, ...newTasks];
      tasksRef.current = next;
      return next;
    });
    return newTasks;
  }, []);

  const startUpload = useCallback(async () => {
    const pending = tasksRef.current.filter((t) => t.status === "pending");
    if (pending.length === 0) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.status === "pending" ? { ...t, status: "uploading" as const } : t,
      ),
    );

    for (const task of pending) {
      if (cancelledRef.current.has(task.id)) continue;

      try {
        await uploadAndSendFile(roomId, task.file, (loaded, total) => {
          if (cancelledRef.current.has(task.id)) return;
          const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, progress } : t)),
          );
        });

        if (cancelledRef.current.has(task.id)) {
          cancelledRef.current.delete(task.id);
          continue;
        }

        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "done" as const, progress: 100 }
              : t,
          ),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: "error" as const, error: msg }
              : t,
          ),
        );
      }
    }

    setTimeout(() => {
      setTasks((prev) => prev.filter((t) => t.status !== "done"));
    }, 3000);
  }, [roomId]);

  const cancelTask = useCallback((taskId: string) => {
    cancelledRef.current.add(taskId);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: "cancelled" as const } : t,
      ),
    );
  }, []);

  const removeTask = useCallback((taskId: string) => {
    cancelledRef.current.delete(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks((prev) =>
      prev.filter(
        (t) => t.status === "pending" || t.status === "uploading",
      ),
    );
  }, []);

  const hasActiveTasks = tasks.some(
    (t) => t.status === "uploading" || t.status === "pending",
  );

  return {
    tasks,
    addFiles,
    startUpload,
    cancelTask,
    removeTask,
    clearCompleted,
    hasActiveTasks,
  };
}
