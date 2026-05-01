import { useState } from "react";
import { useAuthenticatedMedia } from "../hooks/useAuthenticatedMedia.js";

interface ImageMessageProps {
  body: string;
  url: string;
  info?: Record<string, unknown>;
}

export function ImageMessage({ body, url }: ImageMessageProps) {
  const [showFullSize, setShowFullSize] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const [fullError, setFullError] = useState(false);

  const thumbUrl = useAuthenticatedMedia(url, 800, 600, "scale");
  const fullUrl = useAuthenticatedMedia(showFullSize ? url : null);

  return (
    <>
      <button
        onClick={() => {
          setShowFullSize(true);
          setFullError(false);
        }}
        className="block"
      >
        {thumbUrl && !thumbError ? (
          <img
            src={thumbUrl}
            alt={body}
            loading="lazy"
            className="block rounded-lg"
            style={{ maxWidth: 400, maxHeight: 300, width: "auto", height: "auto" }}
            onError={() => setThumbError(true)}
          />
        ) : (
          <div className="flex h-32 w-48 items-center justify-center rounded-lg bg-gray-800 text-xs text-gray-500">
            {thumbError ? "图片加载失败" : "加载中…"}
          </div>
        )}
      </button>

      {showFullSize && (
        <div
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80"
          onClick={() => setShowFullSize(false)}
        >
          {fullUrl && !fullError ? (
            <img
              src={fullUrl}
              alt={body}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              onError={() => setFullError(true)}
            />
          ) : (
            <div className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white">
              {fullError ? "图片加载失败" : "加载中…"}
            </div>
          )}
        </div>
      )}
    </>
  );
}
