import { useState, useMemo } from "react";
import { mxcToHttp } from "@magic/matrix-client";

interface ImageMessageProps {
  body: string;
  url: string;
  info?: Record<string, unknown>;
}

export function ImageMessage({ body, url, info }: ImageMessageProps) {
  const [showFullSize, setShowFullSize] = useState(false);

  const thumbUrl = useMemo(() => {
    try { return mxcToHttp(url, 400, 300, "scale"); } catch { return null; }
  }, [url]);

  const fullUrl = useMemo(() => {
    try { return mxcToHttp(url); } catch { return null; }
  }, [url]);

  const width = (info?.w as number) ?? 300;
  const height = (info?.h as number) ?? 200;
  const aspectRatio = width / height;
  const displayWidth = Math.min(width, 400);
  const displayHeight = displayWidth / aspectRatio;

  return (
    <>
      <button
        onClick={() => setShowFullSize(true)}
        className="block overflow-hidden rounded-lg"
      >
        <img
          src={thumbUrl ?? ""}
          alt={body}
          loading="lazy"
          className="max-w-full object-cover"
          style={{ width: displayWidth, height: displayHeight, maxHeight: 300 }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = "";
            (e.target as HTMLImageElement).alt = "图片加载失败";
          }}
        />
      </button>

      {showFullSize && fullUrl && (
        <div
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80"
          onClick={() => setShowFullSize(false)}
        >
          <img
            src={fullUrl}
            alt={body}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}
