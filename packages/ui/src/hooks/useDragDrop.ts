import { useState, useCallback, useRef, type DragEvent } from "react";

interface UseDragDropOptions {
  onDrop: (files: File[]) => void;
  accept?: string[];
}

export function useDragDrop({ onDrop, accept }: UseDragDropOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 0) return;

      const filtered = accept
        ? droppedFiles.filter((f) =>
            accept.some((pattern) =>
              pattern.endsWith("/*")
                ? f.type.startsWith(pattern.replace("/*", "/"))
                : f.type === pattern,
            ),
          )
        : droppedFiles;

      if (filtered.length > 0) {
        onDrop(filtered);
      }
    },
    [onDrop, accept],
  );

  const dragProps = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  };

  return { isDragging, dragProps };
}
