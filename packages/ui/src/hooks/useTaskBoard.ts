import { useMemo } from "react";
import { useAgentStore, type TaskData } from "@magic/matrix-client";

export interface TaskColumn {
  key: TaskData["status"];
  label: string;
  color: string;
  tasks: TaskData[];
}

const PRIORITY_ORDER: Record<TaskData["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function useTaskBoard(roomId: string | null) {
  const allTasks = useAgentStore((s) => s.tasks);

  const columns: TaskColumn[] = useMemo(() => {
    if (!roomId) return [];

    const roomTasks = Object.values(allTasks).filter((t) => t.roomId === roomId);

    const grouped: Record<TaskData["status"], TaskData[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      failed: [],
    };

    for (const task of roomTasks) {
      grouped[task.status].push(task);
    }

    for (const tasks of Object.values(grouped)) {
      tasks.sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
      );
    }

    return [
      { key: "pending", label: "待处理", color: "text-gray-400", tasks: grouped.pending },
      { key: "in_progress", label: "进行中", color: "text-blue-400", tasks: grouped.in_progress },
      { key: "completed", label: "已完成", color: "text-green-400", tasks: grouped.completed },
      { key: "failed", label: "失败", color: "text-red-400", tasks: grouped.failed },
    ];
  }, [allTasks, roomId]);

  const totalTasks = columns.reduce((sum, col) => sum + col.tasks.length, 0);

  return { columns, totalTasks };
}
