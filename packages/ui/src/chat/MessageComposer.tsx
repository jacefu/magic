import { useEffect } from "react";
import { useRoomStore } from "@magic/matrix-client";
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

// Composer per design-system § 7.4:
//   - Field bg #383A40 (--bg-modifier), 8px radius
//   - Padding 8px 12px
//   - Helper hint below the field, 12px --text-faint
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

  const room = useRoomStore((s) => s.rooms[roomId]);
  const placeholder = room?.name ? `发消息到 #${room.name}` : "输入消息…";

  useEffect(() => {
    switchRoom(roomId);
  }, [roomId, switchRoom]);

  usePasteFile({
    enabled: !!onPasteFile,
    onPaste: (file) => onPasteFile?.(file),
  });

  return (
    <div className="bg-[#313338] px-4 pb-5 pt-2">
      {replyEvent && <ReplyPreview event={replyEvent} onCancel={cancelReply} />}

      <div
        className="flex items-end gap-2 rounded-lg bg-[#383A40] px-3 py-2
                   transition-colors focus-within:ring-1 focus-within:ring-[#5865F2]/40"
      >
        <ComposerInput
          ref={inputRef}
          value={value}
          onChange={setValue}
          onSend={handleSend}
          disabled={isSending}
          placeholder={placeholder}
          roomId={roomId}
        />

        <button
          onClick={handleSend}
          disabled={isSending || !value.trim()}
          className="shrink-0 rounded-md p-1.5 text-[#5865F2] transition-colors
                     hover:bg-[#5865F2]/10 disabled:text-[#6D6F78]
                     disabled:hover:bg-transparent"
          title="发送 (Enter)"
        >
          <SendIcon />
        </button>
      </div>

      <ComposerToolbar roomId={roomId} onFilesSelected={onFilesSelected} />
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
