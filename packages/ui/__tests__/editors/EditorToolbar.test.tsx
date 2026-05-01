import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorToolbar } from "../../src/editors/EditorToolbar.js";

function defaultProps(overrides = {}) {
  return {
    fileType: "soul" as const,
    onFileTypeChange: vi.fn(),
    isDirty: false,
    isSaving: false,
    showDiff: false,
    onToggleDiff: vi.fn(),
    onSave: vi.fn(),
    onRevert: vi.fn(),
    ...overrides,
  };
}

describe("EditorToolbar", () => {
  it("renders both file tabs", () => {
    render(<EditorToolbar {...defaultProps()} />);
    expect(screen.getByText("SOUL.md")).toBeTruthy();
    expect(screen.getByText("MEMORY.md")).toBeTruthy();
  });

  it("highlights the active SOUL tab", () => {
    render(<EditorToolbar {...defaultProps({ fileType: "soul" })} />);
    expect(screen.getByText("SOUL.md").className).toContain("bg-brand");
  });

  it("highlights the active MEMORY tab", () => {
    render(<EditorToolbar {...defaultProps({ fileType: "memory" })} />);
    expect(screen.getByText("MEMORY.md").className).toContain("bg-brand");
  });

  it("calls onFileTypeChange with 'memory' when MEMORY tab is clicked", () => {
    const onFileTypeChange = vi.fn();
    render(<EditorToolbar {...defaultProps({ onFileTypeChange })} />);
    fireEvent.click(screen.getByText("MEMORY.md"));
    expect(onFileTypeChange).toHaveBeenCalledWith("memory");
  });

  it("hides Diff and 恢复 buttons when not dirty", () => {
    render(<EditorToolbar {...defaultProps({ isDirty: false })} />);
    expect(screen.queryByText("Diff")).toBeNull();
    expect(screen.queryByText("恢复")).toBeNull();
  });

  it("shows Diff and 恢复 buttons when dirty", () => {
    render(<EditorToolbar {...defaultProps({ isDirty: true })} />);
    expect(screen.getByText("Diff")).toBeTruthy();
    expect(screen.getByText("恢复")).toBeTruthy();
  });

  it("disables Save button when not dirty", () => {
    render(<EditorToolbar {...defaultProps({ isDirty: false })} />);
    const saveBtn = screen.getByText("保存") as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("disables Save button while saving", () => {
    render(<EditorToolbar {...defaultProps({ isDirty: true, isSaving: true })} />);
    const saveBtn = screen.getByText("保存中…") as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("calls onSave when Save button is clicked", () => {
    const onSave = vi.fn();
    render(<EditorToolbar {...defaultProps({ isDirty: true, onSave })} />);
    fireEvent.click(screen.getByText("保存"));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("calls onToggleDiff when Diff button is clicked", () => {
    const onToggleDiff = vi.fn();
    render(<EditorToolbar {...defaultProps({ isDirty: true, onToggleDiff })} />);
    fireEvent.click(screen.getByText("Diff"));
    expect(onToggleDiff).toHaveBeenCalledOnce();
  });

  it("highlights Diff button when showDiff is true", () => {
    render(<EditorToolbar {...defaultProps({ isDirty: true, showDiff: true })} />);
    expect(screen.getByText("Diff").className).toContain("text-brand");
  });

  it("calls onRevert when 恢复 is clicked", () => {
    const onRevert = vi.fn();
    render(<EditorToolbar {...defaultProps({ isDirty: true, onRevert })} />);
    fireEvent.click(screen.getByText("恢复"));
    expect(onRevert).toHaveBeenCalledOnce();
  });
});
