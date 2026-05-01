import { useCallback, useRef } from "react";
import { uploadAndSendFile } from "@magic/matrix-client";

interface ComposerToolbarProps {
  roomId: string;
}

export function ComposerToolbar({ roomId }: ComposerToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAttach = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // allow re-selecting the same file
      if (!file) return;
      try {
        await uploadAndSendFile(roomId, file);
      } catch (err) {
        console.error("文件上传失败:", err);
      }
    },
    [roomId],
  );

  return (
    <div className="mt-1 flex items-center gap-1">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={handleAttach}
        className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300
                   transition-colors"
        title="发送文件"
      >
        <AttachIcon />
      </button>

      <span className="ml-auto text-[10px] text-gray-600">
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
