import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAuthStore } from "@magic/matrix-client";
import { MentionPill } from "../../src/mentions/MentionPill.js";

beforeEach(() => {
  useAuthStore.setState({ userId: "@me:example.com", homeserver: "h" });
});

/**
 * The visible "@displayName" text is wrapped in an inner <span>; the
 * styled "pill" is the outer span carrying the title attribute and the
 * brand-tinted classes. Helper: walk up to the labelled element.
 */
function getPillRoot(textNode: HTMLElement): HTMLElement {
  const root = textNode.closest("span[title]");
  if (!root) throw new Error("pill root not found");
  return root as HTMLElement;
}

describe("MentionPill", () => {
  it("renders @displayName", () => {
    render(<MentionPill userId="@alice:example.com" displayName="alice" />);
    expect(screen.getByText("@alice")).toBeTruthy();
  });

  it("uses self-mention styling when userId matches current user", () => {
    render(<MentionPill userId="@me:example.com" displayName="me" />);
    const pill = getPillRoot(screen.getByText("@me"));
    // Self-mention reads as pure-white text on the brighter gradient.
    expect(pill.className).toContain("text-white");
    expect(pill.style.background).toContain("rgba(108,92,231,0.35)");
  });

  it("uses other-mention styling when userId differs", () => {
    render(<MentionPill userId="@alice:example.com" displayName="alice" />);
    const pill = getPillRoot(screen.getByText("@alice"));
    expect(pill.className).toContain("text-[#A5B4FC]");
    expect(pill.style.background).toContain("rgba(108,92,231,0.25)");
  });

  it("renders as a rounded rectangle, not a full pill", () => {
    render(<MentionPill userId="@alice:example.com" displayName="alice" />);
    const pill = getPillRoot(screen.getByText("@alice"));
    expect(pill.className).toContain("rounded");
    expect(pill.className).not.toContain("rounded-full");
  });

  it("includes an inline avatar next to the name", () => {
    const { container } = render(
      <MentionPill userId="@alice:example.com" displayName="alice" />,
    );
    // 18px avatar slot rendered by RoomAvatar
    const avatar = container.querySelector('[style*="width: 18"]');
    expect(avatar).toBeTruthy();
  });

  it("sets title to userId for hover tooltip", () => {
    render(<MentionPill userId="@alice:example.com" displayName="alice" />);
    const pill = getPillRoot(screen.getByText("@alice"));
    expect(pill.getAttribute("title")).toBe("@alice:example.com");
  });
});
