import { useCallback, useRef } from "react";
import { uploadAndSendFile } from "@magic/matrix-client";

interface ComposerToolbarProps {
  roomId: string;
  /**
   * If provided, selected files are routed to the parent for preview/progress UI.
   * If absent, files are uploaded directly via uploadAndSendFile (legacy path).
   */
  onFilesSelected?: (files: File[]) => void;
}

export function ComposerToolbar({ roomId, onFilesSelected }: ComposerToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAttach = useCallback(() => {
    inputRef.current?.click();
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

      // Legacy path: upload immediately without preview
      try {
        for (const file of files) {
          await uploadAndSendFile(roomId, file);
        }
      } catch (err) {
        console.error("文件上传失败:", err);
      }
    },
    [roomId, onFilesSelected],
  );

  return (
    <div className="mt-1 flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={handleAttach}
        className="rounded p-1 text-text-muted hover:bg-bg-secondary hover:text-text-normal
                   transition-colors"
        title="发送文件"
      >
        <AttachIcon />
      </button>

      <span className="ml-auto text-[10px] text-text-faint">
        支持 Markdown · Enter 发送 · Shift+Enter 换行
      </span>
    </div>
  );
}

function AttachIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
      />
    </svg>
  );
}
