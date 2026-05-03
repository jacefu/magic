import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UnreadDivider } from "../../src/chat/UnreadDivider.js";

describe("UnreadDivider", () => {
  it("renders the 新的 badge", () => {
    render(<UnreadDivider date={null} />);
    expect(screen.getByText("新的")).toBeTruthy();
  });

  it("does not render a date label when date is null", () => {
    const { container } = render(<UnreadDivider date={null} />);
    // Only one rule + the badge — no date span between rules. The
    // divider uses Cosmic AI's danger token (#F43F5E) for both.
    const rules = container.querySelectorAll(".bg-\\[\\#F43F5E\\]");
    expect(rules.length).toBe(2);
  });

  it("renders the date label centered between two rules when provided", () => {
    render(<UnreadDivider date="2026年4月30日" />);
    expect(screen.getByText("2026年4月30日")).toBeTruthy();
    expect(screen.getByText("新的")).toBeTruthy();
  });
});
