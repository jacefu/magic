import { useCallback } from "react";
import { useRoomStore, useUIStore } from "@magic/matrix-client";
import { ChatHeader } from "./ChatHeader.js";
import { ChatTimeline } from "./ChatTimeline.js";
import { MessageComposer } from "./MessageComposer.js";

export function ChatView() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId);
  const setReplyTo = useUIStore((s) => s.setComposerReplyTo);

  const handleReply = useCallback(
    (eventId: string) => {
      setReplyTo(eventId);
    },
    [setReplyTo],
  );

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
      <ChatTimeline roomId={activeRoomId} onReply={handleReply} />
      <MessageComposer roomId={activeRoomId} />
    </div>
  );
}
