import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileUploadPreview } from "../../src/files/FileUploadPreview.js";
import type { UploadTask } from "../../src/hooks/useFileUpload.js";

function makeTask(overrides: Partial<UploadTask> = {}): UploadTask {
  return {
    id: overrides.id ?? "task-1",
    file: overrides.file ?? new File(["hello"], "test.txt", { type: "text/plain" }),
    progress: overrides.progress ?? 0,
    status: overrides.status ?? "pending",
  };
}

describe("FileUploadPreview", () => {
  it("renders nothing when no pending tasks", () => {
    const { container } = render(
      <FileUploadPreview
        tasks={[]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when only non-pending tasks exist", () => {
    const { container } = render(
      <FileUploadPreview
        tasks={[makeTask({ status: "done" })]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows count of pending files", () => {
    render(
      <FileUploadPreview
        tasks={[makeTask({ id: "1" }), makeTask({ id: "2" })]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("2 个文件待发送")).toBeTruthy();
  });

  it("displays file names and sizes", () => {
    render(
      <FileUploadPreview
        tasks={[makeTask()]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("test.txt")).toBeTruthy();
    expect(screen.getByText("5 B")).toBeTruthy();
  });

  it("calls onConfirm when send button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <FileUploadPreview
        tasks={[makeTask()]}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("发送"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when 全部取消 is clicked", () => {
    const onCancel = vi.fn();
    render(
      <FileUploadPreview
        tasks={[makeTask()]}
        onConfirm={vi.fn()}
        onCancel={onCancel}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("全部取消"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onRemove with task id when × is clicked on an item", () => {
    const onRemove = vi.fn();
    const { container } = render(
      <FileUploadPreview
        tasks={[makeTask({ id: "abc" })]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onRemove={onRemove}
      />,
    );
    // The remove button is the only nested button (besides 发送 / 全部取消)
    const removeButton = container.querySelectorAll(
      "div.flex.items-center.gap-2\\.5 button",
    )[0];
    fireEvent.click(removeButton!);
    expect(onRemove).toHaveBeenCalledWith("abc");
  });

  it("shows file count suffix when multiple files", () => {
    render(
      <FileUploadPreview
        tasks={[makeTask({ id: "1" }), makeTask({ id: "2" }), makeTask({ id: "3" })]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("发送 (3)")).toBeTruthy();
  });
});
