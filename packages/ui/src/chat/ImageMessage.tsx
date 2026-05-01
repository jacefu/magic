import { useState } from "react";
import { useAuthenticatedMedia } from "../hooks/useAuthenticatedMedia.js";

interface ImageMessageProps {
  body: string;
  url: string;
  info?: Record<string, unknown>;
}

export function ImageMessage({ body, url, info }: ImageMessageProps) {
  const [showFullSize, setShowFullSize] = useState(false);

  const thumbUrl = useAuthenticatedMedia(url, 400, 300, "scale");
  const fullUrl = useAuthenticatedMedia(showFullSize ? url : null);

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
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={body}
            loading="lazy"
            className="max-w-full object-cover"
            style={{ width: displayWidth, height: displayHeight, maxHeight: 300 }}
          />
        ) : (
          <div
            className="flex items-center justify-center bg-gray-800 text-xs text-gray-500"
            style={{ width: displayWidth, height: displayHeight, maxHeight: 300 }}
          >
            加载中…
          </div>
        )}
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
