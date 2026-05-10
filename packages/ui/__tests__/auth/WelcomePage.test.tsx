import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { addServerMock, getRecentInstancesMock } = vi.hoisted(() => ({
  addServerMock: vi.fn(),
  getRecentInstancesMock: vi.fn(),
}));

vi.mock("@magic/matrix-client", async (orig) => {
  const actual = await orig<typeof import("@magic/matrix-client")>();
  return {
    ...actual,
    addServer: addServerMock,
    getRecentInstances: getRecentInstancesMock,
  };
});

import { WelcomePage } from "../../src/auth/WelcomePage.js";

beforeEach(() => {
  addServerMock.mockReset();
  getRecentInstancesMock.mockReset();
  getRecentInstancesMock.mockReturnValue([]);
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("WelcomePage", () => {
  it("renders the brand mark + connect form (no recent history → no quick-connect)", () => {
    render(<WelcomePage />);
    expect(screen.getByText("欢迎使用 MAGIC")).toBeTruthy();
    expect(screen.getByText("连接 Magic 实例")).toBeTruthy();
    expect(screen.queryByText("最近登录")).toBeNull();
  });

  it("renders recent-instances list when history exists", () => {
    getRecentInstancesMock.mockReturnValue([
      {
        url: "https://matrix.example.com",
        username: "alice",
        name: "matrix",
        initial: "M",
        color: "#23A55A",
        lastUsedAt: 1_700_000_000_000,
      },
    ]);
    render(<WelcomePage />);
    expect(screen.getByText("最近登录")).toBeTruthy();
    expect(screen.getByText("matrix")).toBeTruthy();
    expect(screen.getByText(/alice · https:\/\/matrix\.example\.com/)).toBeTruthy();
  });

  it("clicking a recent entry fills homeserver and username", () => {
    getRecentInstancesMock.mockReturnValue([
      {
        url: "https://matrix.example.com",
        username: "alice",
        name: "matrix",
        initial: "M",
        color: "#23A55A",
        lastUsedAt: 1_700_000_000_000,
      },
    ]);
    render(<WelcomePage />);
    const homeserverInput = screen.getByPlaceholderText(
      "https://matrix.magic.com",
    ) as HTMLInputElement;
    const usernameInput = screen.getByPlaceholderText(
      "@user:magic.com 或 user",
    ) as HTMLInputElement;
    expect(homeserverInput.value).toBe("");
    expect(usernameInput.value).toBe("");

    fireEvent.click(screen.getByText("matrix"));
    expect(homeserverInput.value).toBe("https://matrix.example.com");
    expect(usernameInput.value).toBe("alice");
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
