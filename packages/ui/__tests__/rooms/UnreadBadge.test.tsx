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

  it("uses a translucent fill by default (no highlight)", () => {
    render(<UnreadBadge count={3} />);
    const badge = screen.getByText("3");
    // Browsers normalize rgba() with spaces.
    expect(badge.style.background.replace(/\s+/g, "")).toContain(
      "rgba(255,255,255,0.1)",
    );
  });

  it("uses a pink→orange gradient when highlight is true", () => {
    render(<UnreadBadge count={3} highlight={true} />);
    const badge = screen.getByText("3");
    expect(badge.style.background).toContain("linear-gradient");
    expect(badge.style.background).toContain("#E040A0");
    expect(badge.style.background).toContain("#F06040");
  });
});
