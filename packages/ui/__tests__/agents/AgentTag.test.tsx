import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentTag } from "../../src/agents/AgentTag.js";
import type { AgentInfo } from "../../src/lib/agentDetection.js";

function makeInfo(overrides: Partial<AgentInfo> = {}): AgentInfo {
  return {
    isAgent: true,
    runtime: "openclaw",
    role: "worker",
    source: "crd-api",
    tagLabel: "AGENT",
    tagBg: "rgba(88,101,242,0.25)",
    tagColor: "#A5B0FC",
    nameColor: "#A5B0FC",
    ...overrides,
  };
}

describe("AgentTag", () => {
  it("returns null when isAgent is false", () => {
    const { container } = render(
      <AgentTag
        agentInfo={makeInfo({
          isAgent: false,
          runtime: null,
          role: null,
          tagLabel: null,
          tagBg: null,
          tagColor: null,
          nameColor: "#DBDEE1",
        })}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when tagLabel is null", () => {
    const { container } = render(
      <AgentTag agentInfo={makeInfo({ tagLabel: null })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders AGENT for an openclaw worker", () => {
    render(<AgentTag agentInfo={makeInfo()} />);
    expect(screen.getByText("AGENT")).toBeTruthy();
  });

  it("renders HERMES for a hermes worker", () => {
    render(
      <AgentTag
        agentInfo={makeInfo({
          runtime: "hermes",
          tagLabel: "HERMES",
          tagBg: "rgba(237,66,69,0.25)",
          tagColor: "#F47B67",
        })}
      />,
    );
    expect(screen.getByText("HERMES")).toBeTruthy();
  });

  it("renders QWENPAW for a qwenpaw worker", () => {
    render(
      <AgentTag
        agentInfo={makeInfo({
          runtime: "qwenpaw",
          tagLabel: "QWENPAW",
          tagBg: "rgba(35,165,90,0.25)",
          tagColor: "#57F287",
        })}
      />,
    );
    expect(screen.getByText("QWENPAW")).toBeTruthy();
  });

  it("renders MANAGER for a manager", () => {
    render(
      <AgentTag
        agentInfo={makeInfo({
          role: "manager",
          tagLabel: "MANAGER",
          tagBg: "rgba(26,188,156,0.25)",
          tagColor: "#1ABC9C",
          nameColor: "#1ABC9C",
        })}
      />,
    );
    expect(screen.getByText("MANAGER")).toBeTruthy();
  });

  it("applies tagBg + tagColor as inline styles", () => {
    render(<AgentTag agentInfo={makeInfo()} />);
    const tag = screen.getByText("AGENT");
    // Cosmic AI: tagBg is a CSS string (rgba or gradient) applied via
    // `background`. Browsers normalize rgba() with spaces, so strip
    // whitespace before comparing.
    expect(tag.style.background.replace(/\s+/g, "")).toContain(
      "rgba(88,101,242,0.25)",
    );
    // jsdom keeps the raw inline value (#A5B0FC), so compare against the
    // hex literal rather than a browser-normalized rgb().
    expect(tag.style.color).toBe("#A5B0FC");
  });

  it("renders larger size when size=md", () => {
    render(<AgentTag agentInfo={makeInfo()} size="md" />);
    const tag = screen.getByText("AGENT");
    expect(tag.className).toContain("text-[9px]");
  });
});
