import { useAuthStore } from "@magic/matrix-client";
import { useAuth } from "../hooks/useAuth.js";

export function MainLayout() {
  const { userId, homeserver } = useAuthStore();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-magic-surface text-white">
      <aside className="flex w-64 flex-col border-r border-gray-800 bg-magic-surface-alt">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-medium">MAGIC</span>
        </div>

        <div className="flex-1 p-4">
          <p className="text-xs text-gray-500">
            房间列表（005-room-list-sidebar）
          </p>
        </div>

        <div className="border-t border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{userId}</p>
              <p className="truncate text-xs text-gray-500">{homeserver}</p>
            </div>
            <button
              onClick={logout}
              className="ml-2 shrink-0 rounded px-2 py-1 text-xs text-gray-400
                         hover:bg-gray-700 hover:text-white transition-colors"
            >
              登出
            </button>
          </div>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-medium">欢迎回来</h2>
          <p className="mt-2 text-sm text-gray-400">
            选择一个房间开始聊天（006-chat-timeline）
          </p>
        </div>
      </main>
    </div>
  );
}
