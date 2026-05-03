import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoomListItem } from "../../src/rooms/RoomListItem.js";
import type { RoomData } from "@magic/matrix-client";

vi.mock("@magic/matrix-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@magic/matrix-client")>();
  return {
    ...actual,
    mxcToHttp: vi.fn().mockReturnValue(null),
  };
});

function makeRoom(overrides: Partial<RoomData> = {}): RoomData {
  return {
    roomId: "!room:example.com",
    name: "Test Room",
    topic: "",
    avatarMxc: null,
    // Default to a multi-member room so it's classified as a group, not a DM.
    // (DM = exactly 2 joined members, see lib/isDmRoom.ts)
    memberCount: 5,
    unreadCount: 0,
    highlightCount: 0,
    timeline: [],
    lastMessage: null,
    isEncrypted: false,
    isDirect: false,
    lastActivityTs: 0,
    ...overrides,
  };
}

describe("RoomListItem", () => {
  it("renders the room name", () => {
    render(<RoomListItem room={makeRoom()} isActive={false} onSelect={vi.fn()} />);
    expect(screen.getByText("Test Room")).toBeTruthy();
  });

  it("renders '未命名房间' when name is empty", () => {
    render(
      <RoomListItem room={makeRoom({ name: "" })} isActive={false} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("未命名房间")).toBeTruthy();
  });

  it("shows unread badge when unreadCount > 0", () => {
    render(
      <RoomListItem room={makeRoom({ unreadCount: 7 })} isActive={false} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("does not show badge when unreadCount is 0", () => {
    render(<RoomListItem room={makeRoom({ unreadCount: 0 })} isActive={false} onSelect={vi.fn()} />);
    expect(screen.queryByText("0")).toBeNull();
  });

  it("shows '#' prefix for group rooms (>2 members)", () => {
    render(
      <RoomListItem
        room={makeRoom({ memberCount: 5 })}
        isActive={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("#")).toBeTruthy();
  });

  it("does not render '#' for 2-member rooms (DMs)", () => {
    render(
      <RoomListItem
        room={makeRoom({ memberCount: 2 })}
        isActive={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText("#")).toBeNull();
  });

  it("renders a status dot for 2-member rooms (DMs)", () => {
    const { container } = render(
      <RoomListItem
        room={makeRoom({ memberCount: 2 })}
        isActive={false}
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it("does not render a message preview line", () => {
    const room = makeRoom({
      lastMessage: {
        eventId: "$ev",
        roomId: "!room:example.com",
        type: "m.room.message",
        sender: "@alice:example.com",
        content: { msgtype: "m.text", body: "should not appear" },
        timestamp: Date.now(),
      },
    });
    render(<RoomListItem room={room} isActive={false} onSelect={vi.fn()} />);
    expect(screen.queryByText("should not appear")).toBeNull();
  });

  it("does not render a relative timestamp", () => {
    render(
      <RoomListItem
        room={makeRoom({ lastActivityTs: Date.now() - 30 * 60_000 })}
        isActive={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText(/分钟前/)).toBeNull();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    render(<RoomListItem room={makeRoom()} isActive={false} onSelect={onSelect} />);
    screen.getByRole("button").click();
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("applies active styling when isActive is true", () => {
    render(<RoomListItem room={makeRoom()} isActive={true} onSelect={vi.fn()} />);
    const button = screen.getByRole("button");
    // Spec § 7.2 + § 11 — active state resolves through theme-aware
    // CSS variables (--bg-active gradient + --border-active edge).
    expect(button.style.background).toBe("var(--bg-active)");
    expect(button.style.borderColor).toBe("var(--border-active)");
    // Active text uses --text-primary so it stays readable in both
    // themes (white-ish on dark, black-ish on light).
    expect(button.className).toContain("text-[var(--text-primary)]");
  });
});
