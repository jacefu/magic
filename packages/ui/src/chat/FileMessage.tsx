import { useMemo } from "react";
import { mxcToHttp } from "@magic/matrix-client";

interface FileMessageProps {
  body: string;
  url: string;
  msgtype: string;
  info?: Record<string, unknown>;
}

export function FileMessage({ body, url, msgtype, info }: FileMessageProps) {
  const httpUrl = useMemo(() => {
    try { return mxcToHttp(url); } catch { return null; }
  }, [url]);

  const size = info?.size as number | undefined;
  const sizeStr = size ? formatFileSize(size) : "";
  const icon = getFileIcon(msgtype);

  return (
    <a
      href={httpUrl ?? "#"}
      download={body}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-lg border border-gray-700 bg-gray-800/50
                 px-3 py-2 transition-colors hover:bg-gray-700/50"
    >
      <span className="text-lg">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-200">{body}</p>
        {sizeStr && <p className="text-xs text-gray-500">{sizeStr}</p>}
      </div>
      <DownloadIcon />
    </a>
  );
}

function getFileIcon(msgtype: string): string {
  switch (msgtype) {
    case "m.audio": return "🎵";
    case "m.video": return "🎬";
    default: return "📎";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}
