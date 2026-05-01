import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDragDrop } from "../../src/hooks/useDragDrop.js";
import type { DragEvent } from "react";

function makeDragEvent(
  overrides: Partial<{ types: string[]; files: File[] }> = {},
): DragEvent {
  const types = overrides.types ?? ["Files"];
  const files = overrides.files ?? [];
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: { types, files },
  } as unknown as DragEvent;
}

describe("useDragDrop", () => {
  it("starts not dragging", () => {
    const { result } = renderHook(() => useDragDrop({ onDrop: vi.fn() }));
    expect(result.current.isDragging).toBe(false);
  });

  it("sets isDragging on dragEnter with files", () => {
    const { result } = renderHook(() => useDragDrop({ onDrop: vi.fn() }));
    act(() => result.current.dragProps.onDragEnter(makeDragEvent()));
    expect(result.current.isDragging).toBe(true);
  });

  it("does not set isDragging when types lacks Files", () => {
    const { result } = renderHook(() => useDragDrop({ onDrop: vi.fn() }));
    act(() =>
      result.current.dragProps.onDragEnter(makeDragEvent({ types: ["text/plain"] })),
    );
    expect(result.current.isDragging).toBe(false);
  });

  it("clears isDragging when drag counter returns to 0", () => {
    const { result } = renderHook(() => useDragDrop({ onDrop: vi.fn() }));
    act(() => result.current.dragProps.onDragEnter(makeDragEvent()));
    act(() => result.current.dragProps.onDragLeave(makeDragEvent()));
    expect(result.current.isDragging).toBe(false);
  });

  it("keeps isDragging when nested drag enters then leaves once", () => {
    const { result } = renderHook(() => useDragDrop({ onDrop: vi.fn() }));
    act(() => result.current.dragProps.onDragEnter(makeDragEvent()));
    act(() => result.current.dragProps.onDragEnter(makeDragEvent()));
    act(() => result.current.dragProps.onDragLeave(makeDragEvent()));
    expect(result.current.isDragging).toBe(true);
  });

  it("calls onDrop with dropped files", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useDragDrop({ onDrop }));
    const file = new File(["x"], "x.txt", { type: "text/plain" });
    act(() => result.current.dragProps.onDrop(makeDragEvent({ files: [file] })));
    expect(onDrop).toHaveBeenCalledWith([file]);
    expect(result.current.isDragging).toBe(false);
  });

  it("filters files by accept patterns", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useDragDrop({ onDrop, accept: ["image/*"] }),
    );
    const img = new File(["x"], "a.png", { type: "image/png" });
    const txt = new File(["x"], "a.txt", { type: "text/plain" });
    act(() =>
      result.current.dragProps.onDrop(makeDragEvent({ files: [img, txt] })),
    );
    expect(onDrop).toHaveBeenCalledWith([img]);
  });

  it("does not call onDrop when no files match accept filter", () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() =>
      useDragDrop({ onDrop, accept: ["image/*"] }),
    );
    const txt = new File(["x"], "a.txt", { type: "text/plain" });
    act(() => result.current.dragProps.onDrop(makeDragEvent({ files: [txt] })));
    expect(onDrop).not.toHaveBeenCalled();
  });
});
