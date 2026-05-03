export function DropZoneOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center
                 border-2 border-dashed border-[var(--brand-purple)] bg-[var(--brand-purple)]/10"
    >
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-purple)]/20">
          <svg
            className="h-7 w-7 text-[var(--brand-purple)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--brand-purple)]">拖放文件到此处上传</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">支持图片、文档、音视频等文件</p>
      </div>
    </div>
  );
}
