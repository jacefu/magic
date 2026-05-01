import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerificationEmojiGrid } from "../../src/crypto/VerificationEmojiGrid.js";

describe("VerificationEmojiGrid", () => {
  it("renders all emoji symbols and names", () => {
    const emoji: Array<[string, string]> = [
      ["🐶", "Dog"],
      ["🐱", "Cat"],
      ["🐭", "Mouse"],
      ["🐹", "Hamster"],
      ["🐰", "Rabbit"],
      ["🦊", "Fox"],
      ["🐻", "Bear"],
    ];
    render(<VerificationEmojiGrid emoji={emoji} />);
    for (const [symbol, name] of emoji) {
      expect(screen.getByText(symbol)).toBeTruthy();
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it("uses 7-column grid", () => {
    const { container } = render(<VerificationEmojiGrid emoji={[]} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.className).toContain("grid-cols-7");
  });

  it("renders nothing when emoji array is empty", () => {
    const { container } = render(<VerificationEmojiGrid emoji={[]} />);
    const grid = container.firstChild as HTMLElement;
    expect(grid.children).toHaveLength(0);
  });

  it("each cell has flex-col layout", () => {
    const { container } = render(
      <VerificationEmojiGrid emoji={[["⭐", "Star"]]} />,
    );
    const cell = container.querySelector(".flex-col");
    expect(cell).toBeTruthy();
  });
});
