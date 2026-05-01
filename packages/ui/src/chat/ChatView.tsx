import { useCallback } from "react";
import { useRoomStore, useUIStore } from "@magic/matrix-client";
import { ChannelHeader } from "./ChannelHeader.js";
import { ChatTimeline } from "./ChatTimeline.js";
import { MessageComposer } from "./MessageComposer.js";
import { FileUploadPreview } from "../files/FileUploadPreview.js";
import { UploadProgressBar } from "../files/UploadProgressBar.js";
import { DropZoneOverlay } from "../files/DropZoneOverlay.js";
import { useFileUpload } from "../hooks/useFileUpload.js";
import { useDragDrop } from "../hooks/useDragDrop.js";

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
      <div className="flex flex-1 items-center justify-center bg-[#313338]">
        <div className="text-center">
          <h2 className="text-xl font-medium text-[#DBDEE1]">选择一个房间</h2>
          <p className="mt-2 text-sm text-[#949BA4]">
            从左侧列表中选择一个房间开始聊天
          </p>
        </div>
      </div>
    );
  }

  return <ChatViewContent roomId={activeRoomId} onReply={handleReply} />;
}

function ChatViewContent({
  roomId,
  onReply,
}: {
  roomId: string;
  onReply: (eventId: string) => void;
}) {
  const { tasks, addFiles, startUpload, cancelTask, removeTask } =
    useFileUpload(roomId);

  const { isDragging, dragProps } = useDragDrop({
    onDrop: (files) => addFiles(files),
  });

  const handlePasteFile = useCallback(
    (file: File) => {
      addFiles([file]);
    },
    [addFiles],
  );

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      addFiles(files);
    },
    [addFiles],
  );

  const handleCancelAll = useCallback(() => {
    const pending = tasks.filter((t) => t.status === "pending");
    pending.forEach((t) => removeTask(t.id));
  }, [tasks, removeTask]);

  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden bg-[#313338]"
      {...dragProps}
    >
      <ChannelHeader roomId={roomId} />
      <ChatTimeline roomId={roomId} onReply={onReply} />

      <UploadProgressBar tasks={tasks} onCancel={cancelTask} />

      <FileUploadPreview
        tasks={tasks}
        onConfirm={startUpload}
        onCancel={handleCancelAll}
        onRemove={removeTask}
      />

      <MessageComposer
        roomId={roomId}
        onPasteFile={handlePasteFile}
        onFilesSelected={handleFilesSelected}
      />

      {isDragging && <DropZoneOverlay />}
    </div>
  );
}
