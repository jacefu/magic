import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useRef } from "react";
import { EmojiPicker } from "../../src/chat/EmojiPicker.js";

function Harness({
  open = true,
  onPick,
  onClose,
}: {
  open?: boolean;
  onPick: (e: string) => void;
  onClose: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchorRef} type="button">
        anchor
      </button>
      <EmojiPicker
        open={open}
        onClose={onClose}
        onPick={onPick}
        anchorRef={anchorRef}
      />
    </>
  );
}

describe("EmojiPicker", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <Harness open={false} onPick={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("renders a search box and category tabs when open", () => {
    render(<Harness onPick={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("搜索 emoji")).toBeTruthy();
    // Category tabs are emoji buttons with title attrs ("笑脸", etc.)
    expect(screen.getByTitle("笑脸")).toBeTruthy();
    expect(screen.getByTitle("手势")).toBeTruthy();
  });

  it("clicking an emoji invokes onPick with the character", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} onClose={vi.fn()} />);
    // Default category is smileys; click the first 😀
    const grin = screen.getByTitle("grin");
    fireEvent.click(grin);
    expect(onPick).toHaveBeenCalledWith("😀");
  });

  it("filters across categories when the user types in the search box", () => {
    render(<Harness onPick={vi.fn()} onClose={vi.fn()} />);
    const search = screen.getByPlaceholderText("搜索 emoji") as HTMLInputElement;
    fireEvent.change(search, { target: { value: "fire" } });
    // 🔥 has the keyword "fire" and lives in the objects category — should
    // appear despite the smileys tab being active.
    expect(screen.getByTitle("fire")).toBeTruthy();
  });

  it("shows an empty-state message when nothing matches the query", () => {
    render(<Harness onPick={vi.fn()} onClose={vi.fn()} />);
    const search = screen.getByPlaceholderText("搜索 emoji");
    fireEvent.change(search, { target: { value: "zzznomatch" } });
    expect(screen.getByText("没有找到匹配的 emoji")).toBeTruthy();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(<Harness onPick={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when clicking outside the picker and outside the anchor", () => {
    const onClose = vi.fn();
    render(<Harness onPick={vi.fn()} onClose={onClose} />);
    // Mousedown on document.body — outside both
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close when clicking the anchor button (so it can toggle)", () => {
    const onClose = vi.fn();
    render(<Harness onPick={vi.fn()} onClose={onClose} />);
    const anchor = screen.getByText("anchor");
    fireEvent.mouseDown(anchor);
    expect(onClose).not.toHaveBeenCalled();
  });
});
