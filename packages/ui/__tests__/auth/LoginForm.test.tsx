import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "../../src/auth/LoginForm.js";

describe("LoginForm", () => {
  it("renders username and password labels", () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error={null} />);
    expect(screen.getByLabelText("用户名")).toBeTruthy();
    expect(screen.getByLabelText("密码")).toBeTruthy();
  });

  it("shows login button when not loading", () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error={null} />);
    expect(screen.getByRole("button", { name: "登录" })).toBeTruthy();
  });

  it("disables submit button while loading", () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={true} error={null} />);
    const button = screen.getByRole("button", { name: /登录中/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables submit button when fields are empty", () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error={null} />);
    const button = screen.getByRole("button", { name: "登录" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("displays error message when error prop is set", () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error="用户名或密码错误" />);
    expect(screen.getByText("用户名或密码错误")).toBeTruthy();
  });

  it("does not render error when error is null", () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error={null} />);
    expect(screen.queryByText("用户名或密码错误")).toBeNull();
  });

  it("calls onSubmit with homeserver, username, password on submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} isLoading={false} error={null} />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        "https://matrix.magic.com",
        "alice",
        "secret",
      );
    });
  });

  it("toggles homeserver input when advanced toggle is clicked", () => {
    render(<LoginForm onSubmit={vi.fn()} isLoading={false} error={null} />);
    expect(screen.queryByPlaceholderText("https://matrix.magic.com")).toBeNull();

    fireEvent.click(screen.getByText(/Homeserver 设置/));
    expect(screen.getByPlaceholderText("https://matrix.magic.com")).toBeTruthy();

    fireEvent.click(screen.getByText(/隐藏高级设置/));
    expect(screen.queryByPlaceholderText("https://matrix.magic.com")).toBeNull();
  });
});
