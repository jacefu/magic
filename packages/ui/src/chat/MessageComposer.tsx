import { useEffect, useRef, useCallback, useState } from "react";
import {
  useRoomStore,
  useUIStore,
  uploadAndSendFile,
} from "@magic/matrix-client";
import { useComposer } from "../hooks/useComposer.js";
import { usePasteFile } from "../hooks/usePasteFile.js";
import { ComposerInput } from "./ComposerInput.js";
import { ReplyPreview } from "./ReplyPreview.js";
import { EmojiPicker } from "./EmojiPicker.js";

interface MessageComposerProps {
  roomId: string;
  onPasteFile?: (file: File) => void;
  onFilesSelected?: (files: File[]) => void;
}

// Discord composer layout (single horizontal field with all controls inline):
//   [+ attach]  [text input]  [🎁]  [GIF]  [sticker]  [emoji]  [send]
// Field bg #383A40, 8px radius. No helper hint below.
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const requestComposerInsert = useUIStore((s) => s.requestComposerInsert);

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handlePickEmoji = useCallback(
    (emoji: string) => {
      requestComposerInsert(emoji);
      setEmojiOpen(false);
    },
    [requestComposerInsert],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length === 0) return;
      if (onFilesSelected) {
        onFilesSelected(files);
        return;
      }
      try {
        for (const file of files) await uploadAndSendFile(roomId, file);
      } catch (err) {
        console.error("文件上传失败:", err);
      }
    },
    [roomId, onFilesSelected],
  );

  useEffect(() => {
    switchRoom(roomId);
  }, [roomId, switchRoom]);

  usePasteFile({
    enabled: !!onPasteFile,
    onPaste: (file) => onPasteFile?.(file),
  });

  return (
    <div className="bg-[var(--bg-primary)] px-4 pb-3 pt-2">
      {replyEvent && <ReplyPreview event={replyEvent} onCancel={cancelReply} />}

      <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] pr-2">
        {/* + attach button (left, inside field) */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <ComposerIconButton title="附加" onClick={handleAttach}>
          <PlusCircleIcon />
        </ComposerIconButton>

        {/* Text input — flex-1, vertically centered against the icon row */}
        <div className="flex min-w-0 flex-1 items-center">
          <ComposerInput
            ref={inputRef}
            value={value}
            onChange={setValue}
            onSend={handleSend}
            disabled={isSending}
            placeholder={placeholder}
            roomId={roomId}
          />
        </div>

        {/* Right-side icon cluster */}
        <div className="relative flex shrink-0 items-center gap-1">
          <button
            ref={emojiButtonRef}
            type="button"
            title="emoji"
            onClick={() => setEmojiOpen((v) => !v)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center
                        transition-colors ${
                          emojiOpen
                            ? "text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
          >
            <EmojiIcon />
          </button>
          <EmojiPicker
            open={emojiOpen}
            onClose={() => setEmojiOpen(false)}
            onPick={handlePickEmoji}
            anchorRef={emojiButtonRef}
          />

          {/* Send (only visually present when there's text — Discord behavior) */}
          {value.trim() && (
            <button
              onClick={handleSend}
              disabled={isSending}
              className="ml-0.5 rounded-md p-1.5 text-[var(--brand-purple)] transition-colors
                         hover:bg-[var(--bg-surface)] disabled:opacity-50"
              title="发送 (Enter)"
            >
              <SendIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ComposerIconButton({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center text-[var(--text-secondary)]
                 transition-colors hover:text-[var(--text-primary)]"
    >
      {children}
    </button>
  );
}

function PlusCircleIcon() {
  return (
    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
    </svg>
  );
}

function EmojiIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
      <circle cx="8.5" cy="10" r="1.5" />
      <circle cx="15.5" cy="10" r="1.5" />
      <path d="M12 18a5 5 0 005-5H7a5 5 0 005 5z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}
