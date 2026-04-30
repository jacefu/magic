import { useAuthStore } from "@magic/matrix-client";
import { useAuth } from "../hooks/useAuth.js";
import { RoomList } from "../rooms/RoomList.js";
import { ChatView } from "../chat/ChatView.js";

export function MainLayout() {
  const { userId, homeserver } = useAuthStore();
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-magic-surface text-white">
      <aside className="flex w-64 flex-col border-r border-gray-800 bg-magic-surface-alt">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <span className="text-sm font-bold tracking-wide">MAGIC</span>
        </div>

        <div className="min-h-0 flex-1">
          <RoomList />
        </div>

        <div className="border-t border-gray-800 px-3 py-2.5">
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

      <ChatView />
    </div>
  );
}
