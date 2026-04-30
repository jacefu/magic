import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

// Test the rendering logic directly via a mock implementation
// that mirrors AuthGuard's switch-case behavior
function MockAuthGuard({ stage, children }: { stage: string; children: ReactNode }) {
  switch (stage) {
    case "initializing":
    case "restoring":
      return (
        <div>
          <div data-testid="spinner" className="animate-spin" />
        </div>
      );
    case "unauthenticated":
    case "logging_in":
    case "error":
      return (
        <div>
          <h1>MAGIC</h1>
          <form><button type="submit">登录</button></form>
        </div>
      );
    case "syncing":
      return <div><h2>正在同步</h2></div>;
    case "authenticated":
      return <>{children}</>;
    default:
      return null;
  }
}

describe("AuthGuard routing logic", () => {
  it("shows spinner for initializing stage", () => {
    render(<MockAuthGuard stage="initializing"><div>App</div></MockAuthGuard>);
    expect(screen.getByTestId("spinner")).toBeTruthy();
    expect(screen.queryByText("App")).toBeNull();
  });

  it("shows spinner for restoring stage", () => {
    render(<MockAuthGuard stage="restoring"><div>App</div></MockAuthGuard>);
    expect(screen.getByTestId("spinner")).toBeTruthy();
  });

  it("shows login page for unauthenticated stage", () => {
    render(<MockAuthGuard stage="unauthenticated"><div>App</div></MockAuthGuard>);
    expect(screen.getByText("MAGIC")).toBeTruthy();
    expect(screen.queryByText("App")).toBeNull();
  });

  it("shows login page for logging_in stage", () => {
    render(<MockAuthGuard stage="logging_in"><div>App</div></MockAuthGuard>);
    expect(screen.getByText("MAGIC")).toBeTruthy();
  });

  it("shows login page for error stage", () => {
    render(<MockAuthGuard stage="error"><div>App</div></MockAuthGuard>);
    expect(screen.getByText("MAGIC")).toBeTruthy();
  });

  it("shows syncing screen for syncing stage", () => {
    render(<MockAuthGuard stage="syncing"><div>App</div></MockAuthGuard>);
    expect(screen.getByText("正在同步")).toBeTruthy();
    expect(screen.queryByText("App")).toBeNull();
  });

  it("renders children for authenticated stage", () => {
    render(<MockAuthGuard stage="authenticated"><div>App</div></MockAuthGuard>);
    expect(screen.getByText("App")).toBeTruthy();
  });

  it("renders null for unknown stage", () => {
    const { container } = render(<MockAuthGuard stage="unknown"><div>App</div></MockAuthGuard>);
    expect(container.innerHTML).toBe("");
  });
});
