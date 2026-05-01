import { useEffect, useRef, useCallback } from "react";
import { useRoomStore, uploadAndSendFile } from "@magic/matrix-client";
import { useComposer } from "../hooks/useComposer.js";
import { usePasteFile } from "../hooks/usePasteFile.js";
import { ComposerInput } from "./ComposerInput.js";
import { ReplyPreview } from "./ReplyPreview.js";

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

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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
    <div className="bg-[#313338] px-4 pb-6 pt-2">
      {replyEvent && <ReplyPreview event={replyEvent} onCancel={cancelReply} />}

      <div className="flex items-end gap-1 rounded-lg bg-[#383A40] pr-2">
        {/* + attach button (left, inside field) */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <ComposerIconButton title="附加" onClick={handleAttach} variant="left">
          <PlusCircleIcon />
        </ComposerIconButton>

        {/* Text input — flex-1 */}
        <div className="min-w-0 flex-1 self-center py-2">
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
        <div className="flex shrink-0 items-center gap-1 self-end pb-1.5">
          <ComposerIconButton title="赠送 Nitro">
            <GiftIcon />
          </ComposerIconButton>
          <ComposerIconButton title="GIF">
            <GifIcon />
          </ComposerIconButton>
          <ComposerIconButton title="贴纸">
            <StickerIcon />
          </ComposerIconButton>
          <ComposerIconButton title="emoji">
            <EmojiIcon />
          </ComposerIconButton>

          {/* Send (only visually present when there's text — Discord behavior) */}
          {value.trim() && (
            <button
              onClick={handleSend}
              disabled={isSending}
              className="ml-0.5 rounded-md p-1.5 text-[#5865F2] transition-colors
                         hover:bg-[#5865F2]/10 disabled:opacity-50"
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
  variant,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  variant?: "left";
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center text-[#B5BAC1]
                  transition-colors hover:text-[#DBDEE1]
                  ${variant === "left" ? "self-end pb-1.5" : ""}`}
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

function GiftIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20 7h-2.586l1.793-1.793-1.414-1.414L15 6.586V4h-2v2.586l-2.793-2.793-1.414 1.414L10.586 7H4a1 1 0 00-1 1v3a1 1 0 001 1v8a2 2 0 002 2h12a2 2 0 002-2v-8a1 1 0 001-1V8a1 1 0 00-1-1zm-7 13h-2v-7h2v7zm-8-9V9h6v2H5zm14 0h-6V9h6v2z" />
    </svg>
  );
}

function GifIcon() {
  return (
    <span className="text-[10px] font-bold leading-none">GIF</span>
  );
}

function StickerIcon() {
  return (
    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21.84 11.05c-.16-.71-1.06-1.05-1.69-.66l-.39.24c-.66.41-1.51-.06-1.51-.84V8.05c0-1.66-1.34-3-3-3h-1.74c-.78 0-1.25-.85-.84-1.51l.24-.39c.39-.63.05-1.53-.66-1.69-3.17-.74-7 .14-9.5 2.65-2.51 2.5-3.39 6.33-2.65 9.5.16.71 1.06 1.05 1.69.66l.39-.24c.66-.41 1.51.06 1.51.84v1.74c0 1.66 1.34 3 3 3h1.74c.78 0 1.25.85.84 1.51l-.24.39c-.39.63-.05 1.53.66 1.69 3.17.74 7-.14 9.5-2.65 2.51-2.5 3.39-6.33 2.65-9.5z" />
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
