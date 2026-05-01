import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnreadBadge } from "../../src/rooms/UnreadBadge.js";

describe("UnreadBadge", () => {
  it("renders nothing when count is zero", () => {
    const { container } = render(<UnreadBadge count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when count is negative", () => {
    const { container } = render(<UnreadBadge count={-1} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the count when positive", () => {
    render(<UnreadBadge count={5} />);
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("truncates counts over 99 to '99+'", () => {
    render(<UnreadBadge count={100} />);
    expect(screen.getByText("99+")).toBeTruthy();
  });

  it("shows 99 without truncation", () => {
    render(<UnreadBadge count={99} />);
    expect(screen.getByText("99")).toBeTruthy();
  });

  it("uses gray background by default", () => {
    render(<UnreadBadge count={3} />);
    const badge = screen.getByText("3");
    expect(badge.className).toContain("bg-[#6D6F78]");
  });

  it("uses red background when highlight is true", () => {
    render(<UnreadBadge count={3} highlight={true} />);
    const badge = screen.getByText("3");
    expect(badge.className).toContain("bg-[#F23F43]");
  });
});
