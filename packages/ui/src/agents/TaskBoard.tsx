import { useTaskBoard } from "../hooks/useTaskBoard.js";
import { TaskCard } from "./TaskCard.js";

interface TaskBoardProps {
  roomId: string;
}

export function TaskBoard({ roomId }: TaskBoardProps) {
  const { columns, totalTasks } = useTaskBoard(roomId);

  if (totalTasks === 0) {
    return (
      <div className="space-y-2 px-2 py-8 text-center">
        <p className="text-sm text-gray-400">当前房间暂无任务</p>
        <p className="text-xs leading-relaxed text-gray-600">
          任务通过 <code className="rounded bg-gray-800 px-1 py-0.5 text-[10px]">com.magic.task.assignment</code> 状态事件创建。
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div key={col.key} className="w-56 shrink-0">
          <div className="mb-2 flex items-center justify-between">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}
            >
              {col.label}
            </span>
            <span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">
              {col.tasks.length}
            </span>
          </div>

          <div className="space-y-2">
            {col.tasks.map((task) => (
              <TaskCard key={task.taskId} task={task} />
            ))}
            {col.tasks.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-800 py-6 text-center text-xs text-gray-600">
                暂无
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
