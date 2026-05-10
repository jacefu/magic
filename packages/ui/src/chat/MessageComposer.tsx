import { useEffect, useRef, useCallback, useState } from "react";
import {
  useRoomStore,
  useUIStore,
  uploadAndSendFile,
} from "@magic/matrix-client";
import { useComposer } from "../hooks/useComposer.js";
import { usePasteFile } from "../hooks/usePasteFile.js";
import { isElectron } from "../hooks/useElectronAPI.js";
import { BindFolderButton } from "../workspace/BindFolderButton.js";
import { ComposerInput } from "./ComposerInput.js";
import { ReplyPreview } from "./ReplyPreview.js";
import { EmojiPicker } from "./EmojiPicker.js";

interface MessageComposerProps {
  roomId: string;
  onPasteFile?: (file: File) => void;
  onFilesSelected?: (files: File[]) => void;
  /** Fires after the composer ships a message — ChatView uses this
   *  to scroll the timeline to the latest event. */
  onSent?: () => void;
}

// Discord composer layout (single horizontal field with all controls inline):
//   [+ attach]  [text input]  [🎁]  [GIF]  [sticker]  [emoji]  [send]
// Field bg #383A40, 8px radius. No helper hint below.
export function MessageComposer({
  roomId,
  onPasteFile,
  onFilesSelected,
  onSent,
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
  } = useComposer({ roomId, onSent });

  const room = useRoomStore((s) => s.rooms[roomId]);
  const placeholder = room?.name ? `发消息到 #${room.name}` : "输入消息…";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const requestComposerInsert = useUIStore((s) => s.requestComposerInsert);

  // Spec 022 § 4.1 — desktop builds get a small popover menu off the
  // "+" button so we can offer "上传文件" alongside "绑定本地文件夹"
  // without crowding the icon row. On web the workspace feature isn't
  // available so we keep the legacy single-action behaviour and skip
  // the menu entirely.
  const showPlusMenu = isElectron();

  const handleAttach = useCallback(() => {
    if (showPlusMenu) {
      setPlusMenuOpen((v) => !v);
    } else {
      fileInputRef.current?.click();
    }
  }, [showPlusMenu]);

  const openFilePicker = useCallback(() => {
    setPlusMenuOpen(false);
    fileInputRef.current?.click();
  }, []);

  // Click-outside dismissal — without this the menu stays latched open
  // when the user clicks back into the message field or anywhere else.
  //
  // ⚠ Skip when the click lands inside a portaled dialog. The bind-
  // folder confirm dialog lives in a portal at <body> level, but its
  // owning component (BindFolderButton) is rendered as a child of
  // this menu — so closing the menu unmounts the dialog mid-use. The
  // `data-magic-portal` attribute is set by every DialogOverlay host.
  useEffect(() => {
    if (!plusMenuOpen) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (
        typeof target.closest === "function" &&
        target.closest("[data-magic-portal]")
      ) {
        return;
      }
      if (
        plusMenuRef.current?.contains(target) ||
        plusButtonRef.current?.contains(target)
      ) {
        return;
      }
      setPlusMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [plusMenuOpen]);

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
        <div className="relative">
          <button
            ref={plusButtonRef}
            type="button"
            title="附加"
            onClick={handleAttach}
            className={`flex h-9 w-9 shrink-0 items-center justify-center transition-colors ${
              plusMenuOpen
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <PlusCircleIcon />
          </button>

          {showPlusMenu && plusMenuOpen && (
            <div
              ref={plusMenuRef}
              className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-lg border-[0.5px] p-1 shadow-lg"
              style={{
                background: "var(--bg-primary)",
                borderColor: "var(--border-default)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                animation: "fade-in-up 0.15s ease-out",
              }}
            >
              <button
                type="button"
                onClick={openFilePicker}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12.5px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                <span aria-hidden className="text-[14px]">
                  📎
                </span>
                <span>上传文件</span>
              </button>
              <BindFolderButton
                roomId={roomId}
                peerLabel={room?.name ?? "Agent"}
                variant="menu"
                onAfterBind={() => setPlusMenuOpen(false)}
              />
            </div>
          )}
        </div>

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
