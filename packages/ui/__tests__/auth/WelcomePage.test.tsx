import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { addServerMock } = vi.hoisted(() => ({
  addServerMock: vi.fn(),
}));

vi.mock("@magic/matrix-client", async (orig) => {
  const actual = await orig<typeof import("@magic/matrix-client")>();
  return { ...actual, addServer: addServerMock };
});

import { WelcomePage } from "../../src/auth/WelcomePage.js";

beforeEach(() => {
  addServerMock.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("WelcomePage", () => {
  it("renders the brand mark + connect form + quick-connect presets", () => {
    render(<WelcomePage />);
    expect(screen.getByText("欢迎使用 MAGIC")).toBeTruthy();
    expect(screen.getByText("连接 Magic 实例")).toBeTruthy();
    expect(screen.getByText("HiClaw 本地开发")).toBeTruthy();
    expect(screen.getByText("Matrix.org 公共服务器")).toBeTruthy();
  });

  it("clicking a quick-connect preset fills the homeserver field", () => {
    render(<WelcomePage />);
    const homeserverInput = screen.getByPlaceholderText(
      "https://matrix.magic.com",
    ) as HTMLInputElement;
    expect(homeserverInput.value).toBe("");

    fireEvent.click(screen.getByText("HiClaw 本地开发"));
    expect(homeserverInput.value).toBe(
      "https://matrix-local.hiclaw.io:18080",
    );
  });

  it("submit is disabled until all three fields are filled", () => {
    render(<WelcomePage />);
    const submit = screen.getByRole("button", {
      name: /连接服务器/,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("https://matrix.magic.com"), {
      target: { value: "https://x.org" },
    });
    fireEvent.change(screen.getByPlaceholderText("@user:magic.com 或 user"), {
      target: { value: "alice" },
    });
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("输入密码"), {
      target: { value: "secret" },
    });
    expect(submit.disabled).toBe(false);
  });

  it("submitting calls addServer with trimmed inputs", async () => {
    addServerMock.mockResolvedValue("session_x");
    render(<WelcomePage />);

    fireEvent.change(screen.getByPlaceholderText("https://matrix.magic.com"), {
      target: { value: "https://x.org  " },
    });
    fireEvent.change(screen.getByPlaceholderText("@user:magic.com 或 user"), {
      target: { value: "  alice" },
    });
    fireEvent.change(screen.getByPlaceholderText("输入密码"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /连接服务器/ }));

    await waitFor(() => {
      expect(addServerMock).toHaveBeenCalledWith(
        "https://x.org",
        "alice",
        "secret",
      );
    });
  });

  it("renders the Chinese-language error when login is rejected", async () => {
    addServerMock.mockRejectedValue(new Error("M_FORBIDDEN"));
    render(<WelcomePage />);

    fireEvent.change(screen.getByPlaceholderText("https://matrix.magic.com"), {
      target: { value: "https://x.org" },
    });
    fireEvent.change(screen.getByPlaceholderText("@user:magic.com 或 user"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByPlaceholderText("输入密码"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /连接服务器/ }));

    expect(await screen.findByText("用户名或密码错误")).toBeTruthy();
  });
});
