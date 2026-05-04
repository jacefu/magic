import { useCallback, useRef } from "react";
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
      <div className="flex flex-1 items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <h2 className="text-xl font-medium text-[var(--text-primary)]">选择一个房间</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
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

  // Spec 019 FIX-3 — bridge the composer's post-send signal to the
  // timeline's scroll-to-bottom call so the view always lands on the
  // freshly-sent message instead of staying parked at whatever offset
  // the user happened to be at.
  const scrollToBottomRef = useRef<(() => void) | null>(null);
  const handleSent = useCallback(() => {
    scrollToBottomRef.current?.();
  }, []);

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-primary)]"
      {...dragProps}
    >
      <ChannelHeader roomId={roomId} />
      <ChatTimeline
        roomId={roomId}
        onReply={onReply}
        scrollToBottomRef={scrollToBottomRef}
      />

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
        onSent={handleSent}
      />

      {isDragging && <DropZoneOverlay />}
    </div>
  );
}
