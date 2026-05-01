import { useCallback } from "react";
import { uploadAndSendFile } from "@magic/matrix-client";
import { useElectronAPI } from "../hooks/useElectronAPI.js";

interface ComposerToolbarProps {
  roomId: string;
}

export function ComposerToolbar({ roomId }: ComposerToolbarProps) {
  const electronAPI = useElectronAPI();

  const handleAttach = useCallback(async () => {
    if (electronAPI) {
      const files = await electronAPI.openFileDialog({
        title: "选择文件",
        filters: [
          { name: "所有文件", extensions: ["*"] },
          { name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
          { name: "文档", extensions: ["pdf", "doc", "docx", "txt", "md"] },
        ],
      });
      if (files && files.length > 0) {
        // TODO: 009-file-attachments handles full upload pipeline
        console.log("选择的文件:", files);
      }
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = false;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) {
          try {
            await uploadAndSendFile(roomId, file);
          } catch (err) {
            console.error("文件上传失败:", err);
          }
        }
      };
      input.click();
    }
  }, [roomId, electronAPI]);

  return (
    <div className="mt-1 flex items-center gap-1">
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
