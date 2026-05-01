import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ComposerInput } from "../../src/chat/ComposerInput.js";

describe("ComposerInput", () => {
  it("renders the placeholder", () => {
    render(
      <ComposerInput
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        placeholder="Type something"
      />,
    );
    expect(screen.getByPlaceholderText("Type something")).toBeTruthy();
  });

  it("calls onChange as user types", () => {
    const onChange = vi.fn();
    render(<ComposerInput value="" onChange={onChange} onSend={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hi" } });
    expect(onChange).toHaveBeenCalledWith("hi");
  });

  it("calls onSend when Enter is pressed without modifiers", () => {
    const onSend = vi.fn();
    render(<ComposerInput value="hello" onChange={vi.fn()} onSend={onSend} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("does NOT call onSend when Shift+Enter is pressed", () => {
    const onSend = vi.fn();
    render(<ComposerInput value="hello" onChange={vi.fn()} onSend={onSend} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("calls onSend when Ctrl+Enter is pressed", () => {
    const onSend = vi.fn();
    render(<ComposerInput value="hello" onChange={vi.fn()} onSend={onSend} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", ctrlKey: true });
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("calls onSend when Cmd+Enter is pressed", () => {
    const onSend = vi.fn();
    render(<ComposerInput value="hello" onChange={vi.fn()} onSend={onSend} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", metaKey: true });
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("disables the textarea when disabled=true", () => {
    render(
      <ComposerInput value="hi" onChange={vi.fn()} onSend={vi.fn()} disabled={true} />,
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it("ignores non-Enter keys", () => {
    const onSend = vi.fn();
    render(<ComposerInput value="hi" onChange={vi.fn()} onSend={onSend} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "a" });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(onSend).not.toHaveBeenCalled();
  });
});
