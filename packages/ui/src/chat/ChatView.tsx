import { useRoomStore } from "@magic/matrix-client";
import { ChatHeader } from "./ChatHeader.js";
import { ChatTimeline } from "./ChatTimeline.js";

export function ChatView() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);

  if (!activeRoomId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-medium text-gray-300">选择一个房间</h2>
          <p className="mt-2 text-sm text-gray-500">
            从左侧列表中选择一个房间开始聊天
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ChatHeader roomId={activeRoomId} />
      <ChatTimeline roomId={activeRoomId} />
      {/* 消息编辑器占位 — 007-message-composer 填充 */}
      <div className="border-t border-gray-800 px-4 py-3">
        <div className="rounded-lg border border-gray-700 bg-magic-surface-alt px-3 py-2 text-sm text-gray-500">
          消息编辑器（Spec 007）
        </div>
      </div>
    </div>
  );
}
