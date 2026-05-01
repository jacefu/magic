import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentStatusCard } from "../../src/agents/AgentStatusCard.js";
import type { AgentWithEffectiveStatus } from "../../src/hooks/useAgentStatus.js";

vi.mock("@magic/matrix-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@magic/matrix-client")>();
  return { ...actual, mxcToHttp: vi.fn().mockReturnValue(null) };
});

function makeAgent(
  overrides: Partial<AgentWithEffectiveStatus> = {},
): AgentWithEffectiveStatus {
  return {
    agentId: "worker-1",
    userId: "@alice:example.com",
    status: "active",
    capabilities: ["coding"],
    model: "claude-sonnet-4-5",
    currentTaskId: null,
    lastHeartbeat: Date.now(),
    roomId: "!r:example.com",
    effectiveStatus: "active",
    ...overrides,
  };
}

describe("AgentStatusCard", () => {
  it("renders display name extracted from userId", () => {
    render(<AgentStatusCard agent={makeAgent()} />);
    expect(screen.getByText("alice")).toBeTruthy();
  });

  it("renders the model name", () => {
    render(<AgentStatusCard agent={makeAgent({ model: "gpt-4" })} />);
    expect(screen.getByText("gpt-4")).toBeTruthy();
  });

  it("falls back to 'Agent' when model is undefined", () => {
    render(<AgentStatusCard agent={makeAgent({ model: undefined })} />);
    expect(screen.getByText("Agent")).toBeTruthy();
  });

  it("shows the current task name when provided", () => {
    render(<AgentStatusCard agent={makeAgent()} taskName="Write tests" />);
    expect(screen.getByText("Write tests")).toBeTruthy();
    expect(screen.getByText("当前任务")).toBeTruthy();
  });

  it("does not render task block when taskName is omitted", () => {
    render(<AgentStatusCard agent={makeAgent()} />);
    expect(screen.queryByText("当前任务")).toBeNull();
  });

  it("renders up to 3 capability tags", () => {
    render(
      <AgentStatusCard
        agent={makeAgent({ capabilities: ["a", "b", "c"] })}
      />,
    );
    expect(screen.getByText("a")).toBeTruthy();
    expect(screen.getByText("b")).toBeTruthy();
    expect(screen.getByText("c")).toBeTruthy();
  });

  it("collapses extra capabilities into a +N indicator", () => {
    render(
      <AgentStatusCard
        agent={makeAgent({ capabilities: ["a", "b", "c", "d", "e"] })}
      />,
    );
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("renders no capability tags when array is empty", () => {
    const { container } = render(
      <AgentStatusCard agent={makeAgent({ capabilities: [] })} />,
    );
    expect(container.querySelectorAll(".rounded-full.bg-bg-secondary")).toHaveLength(0);
  });
});
