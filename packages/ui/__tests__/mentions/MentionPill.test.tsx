import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAuthStore } from "@magic/matrix-client";
import { MentionPill } from "../../src/mentions/MentionPill.js";

beforeEach(() => {
  useAuthStore.setState({ userId: "@me:example.com", homeserver: "h" });
});

describe("MentionPill", () => {
  it("renders @displayName", () => {
    render(<MentionPill userId="@alice:example.com" displayName="alice" />);
    expect(screen.getByText("@alice")).toBeTruthy();
  });

  it("uses self-mention styling when userId matches current user", () => {
    render(<MentionPill userId="@me:example.com" displayName="me" />);
    const pill = screen.getByText("@me");
    expect(pill.className).toContain("bg-brand");
  });

  it("uses other-mention styling when userId differs", () => {
    render(<MentionPill userId="@alice:example.com" displayName="alice" />);
    const pill = screen.getByText("@alice");
    expect(pill.className).toContain("text-role-admin");
  });

  it("sets title to userId for hover tooltip", () => {
    render(<MentionPill userId="@alice:example.com" displayName="alice" />);
    const pill = screen.getByText("@alice");
    expect(pill.getAttribute("title")).toBe("@alice:example.com");
  });
});
