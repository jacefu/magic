import { useEffect } from "react";
import { useComposer } from "../hooks/useComposer.js";
import { usePasteFile } from "../hooks/usePasteFile.js";
import { ComposerInput } from "./ComposerInput.js";
import { ComposerToolbar } from "./ComposerToolbar.js";
import { ReplyPreview } from "./ReplyPreview.js";

interface MessageComposerProps {
  roomId: string;
  onPasteFile?: (file: File) => void;
  onFilesSelected?: (files: File[]) => void;
}

export function MessageComposer({
  roomId,
  onPasteFile,
  onFilesSelected,
}: MessageComposerProps) {
  const {
    value,
    setValue,
    isSending,
    inputRef,
    replyEvent,
    handleSend,
    cancelReply,
    switchRoom,
  } = useComposer({ roomId });

  useEffect(() => {
    switchRoom(roomId);
  }, [roomId, switchRoom]);

  usePasteFile({
    enabled: !!onPasteFile,
    onPaste: (file) => onPasteFile?.(file),
  });

  return (
    <div className="bg-bg-primary px-4 pb-5 pt-2">
      {replyEvent && <ReplyPreview event={replyEvent} onCancel={cancelReply} />}

      <div>
        <div
          className="flex items-end gap-2 rounded-md bg-bg-modifier px-3 py-2
                     transition-colors focus-within:ring-1 focus-within:ring-brand/30"
        >
          <ComposerInput
            ref={inputRef}
            value={value}
            onChange={setValue}
            onSend={handleSend}
            disabled={isSending}
            placeholder="输入消息…"
            roomId={roomId}
          />

          <button
            onClick={handleSend}
            disabled={isSending || !value.trim()}
            className="shrink-0 rounded-lg p-1.5 text-brand transition-colors
                       hover:bg-brand/10 disabled:text-text-faint disabled:hover:bg-transparent"
            title="发送 (Enter)"
          >
            <SendIcon />
          </button>
        </div>

        <ComposerToolbar roomId={roomId} onFilesSelected={onFilesSelected} />
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}
