import { useEffect, useCallback } from "react";

interface UsePasteFileOptions {
  enabled: boolean;
  onPaste: (file: File) => void;
}

export function usePasteFile({ enabled, onPaste }: UsePasteFileOptions) {
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!enabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onPaste(file);
            return;
          }
        }
      }
    },
    [enabled, onPaste],
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [enabled, handlePaste]);
}
