import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { addServerMock } = vi.hoisted(() => ({
  addServerMock: vi.fn(),
}));

vi.mock("@magic/matrix-client", async (orig) => {
  const actual = await orig<typeof import("@magic/matrix-client")>();
  return { ...actual, addServer: addServerMock };
});

import { AddServerDialog } from "../../src/workspace/AddServerDialog.js";

beforeEach(() => {
  addServerMock.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("AddServerDialog", () => {
  it("renders the three input fields and disables submit until they're all filled", () => {
    render(<AddServerDialog onClose={vi.fn()} />);
    const submit = screen.getByRole("button", {
      name: /添加服务器/,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(
      screen.getByPlaceholderText("https://matrix.example.com"),
      { target: { value: "https://x.org" } },
    );
    expect(submit.disabled).toBe(true);

    fireEvent.change(
      screen.getByPlaceholderText("@user:example.com 或 user"),
      { target: { value: "alice" } },
    );
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("输入密码"), {
      target: { value: "pw" },
    });
    expect(submit.disabled).toBe(false);
  });

  it("invokes addServer with trimmed inputs and closes on success", async () => {
    addServerMock.mockResolvedValue("session_x");
    const onClose = vi.fn();
    render(<AddServerDialog onClose={onClose} />);

    fireEvent.change(
      screen.getByPlaceholderText("https://matrix.example.com"),
      { target: { value: "  https://x.org  " } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("@user:example.com 或 user"),
      { target: { value: "  alice  " } },
    );
    fireEvent.change(screen.getByPlaceholderText("输入密码"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /添加服务器/ }));

    await waitFor(() => {
      expect(addServerMock).toHaveBeenCalledWith(
        "https://x.org",
        "alice",
        "secret",
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("surfaces M_FORBIDDEN as a Chinese error message and stays open", async () => {
    addServerMock.mockRejectedValue(new Error("M_FORBIDDEN"));
    const onClose = vi.fn();
    render(<AddServerDialog onClose={onClose} />);

    fireEvent.change(
      screen.getByPlaceholderText("https://matrix.example.com"),
      { target: { value: "https://x.org" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("@user:example.com 或 user"),
      { target: { value: "alice" } },
    );
    fireEvent.change(screen.getByPlaceholderText("输入密码"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /添加服务器/ }));

    expect(await screen.findByText("用户名或密码错误")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Cancel calls onClose without invoking addServer", () => {
    const onClose = vi.fn();
    render(<AddServerDialog onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onClose).toHaveBeenCalled();
    expect(addServerMock).not.toHaveBeenCalled();
  });
});
