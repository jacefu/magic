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
    memberCount: 2,
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

  it("shows '#' prefix for group rooms", () => {
    render(<RoomListItem room={makeRoom({ isDirect: false })} isActive={false} onSelect={vi.fn()} />);
    expect(screen.getByText("#")).toBeTruthy();
  });

  it("does not render '#' for direct messages", () => {
    render(<RoomListItem room={makeRoom({ isDirect: true })} isActive={false} onSelect={vi.fn()} />);
    expect(screen.queryByText("#")).toBeNull();
  });

  it("renders a status dot for direct messages", () => {
    const { container } = render(
      <RoomListItem room={makeRoom({ isDirect: true })} isActive={false} onSelect={vi.fn()} />,
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
    expect(button.className).toContain("bg-[#404249]");
  });
});
