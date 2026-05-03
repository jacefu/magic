import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { RoomInvite } from "@magic/matrix-client";

const mocks = vi.hoisted(() => ({
  acceptInvite: vi.fn(),
  declineInvite: vi.fn(),
  declineAndBlockInvite: vi.fn(),
  setActiveRoom: vi.fn(),
}));

vi.mock("@magic/matrix-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@magic/matrix-client")>();
  return {
    ...actual,
    acceptInvite: mocks.acceptInvite,
    declineInvite: mocks.declineInvite,
    declineAndBlockInvite: mocks.declineAndBlockInvite,
    useRoomStore: Object.assign(
      () => ({ activeRoomId: null }),
      {
        getState: () => ({ setActiveRoom: mocks.setActiveRoom }),
      },
    ),
  };
});

import { InviteDialog } from "../../src/invites/InviteDialog.js";

function makeInvite(overrides: Partial<RoomInvite> = {}): RoomInvite {
  return {
    roomId: "!room:server.example",
    roomName: "项目频道",
    roomAvatarMxc: null,
    inviterId: "@alice:server.example",
    inviterName: "Alice",
    isDirect: false,
    isEncrypted: false,
    timestamp: 1000,
    status: "pending",
    sessionId: "session_a",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.acceptInvite.mockReset();
  mocks.declineInvite.mockReset();
  mocks.declineAndBlockInvite.mockReset();
  mocks.setActiveRoom.mockReset();
});

describe("InviteDialog", () => {
  it("renders the room name, inviter, and three action buttons", () => {
    render(<InviteDialog invite={makeInvite()} onClose={() => {}} />);
    expect(screen.getByText(/是否加入 项目频道/)).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("@alice:server.example")).toBeTruthy();
    expect(screen.getByRole("button", { name: "接受" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "拒绝" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "拒绝并屏蔽" })).toBeTruthy();
  });

  it("uses DM phrasing when isDirect is true", () => {
    render(
      <InviteDialog invite={makeInvite({ isDirect: true })} onClose={() => {}} />,
    );
    expect(screen.getByText(/Alice 想与你私聊/)).toBeTruthy();
  });

  it("shows the encrypted-room badge when isEncrypted is true", () => {
    render(
      <InviteDialog
        invite={makeInvite({ isEncrypted: true })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/此房间已启用端到端加密/)).toBeTruthy();
  });

  it("accept button calls acceptInvite, sets active room, and closes", async () => {
    mocks.acceptInvite.mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<InviteDialog invite={makeInvite()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "接受" }));

    await waitFor(() => {
      expect(mocks.acceptInvite).toHaveBeenCalledWith("!room:server.example");
      expect(mocks.setActiveRoom).toHaveBeenCalledWith("!room:server.example");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("decline button calls declineInvite and closes", async () => {
    mocks.declineInvite.mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<InviteDialog invite={makeInvite()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "拒绝" }));

    await waitFor(() => {
      expect(mocks.declineInvite).toHaveBeenCalledWith("!room:server.example");
      expect(onClose).toHaveBeenCalled();
    });
    expect(mocks.setActiveRoom).not.toHaveBeenCalled();
  });

  it("block button calls declineAndBlockInvite and closes", async () => {
    mocks.declineAndBlockInvite.mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<InviteDialog invite={makeInvite()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "拒绝并屏蔽" }));

    await waitFor(() => {
      expect(mocks.declineAndBlockInvite).toHaveBeenCalledWith(
        "!room:server.example",
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("surfaces an error message when accept fails", async () => {
    mocks.acceptInvite.mockRejectedValue(new Error("加入失败：网络错误"));
    const onClose = vi.fn();
    render(<InviteDialog invite={makeInvite()} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "接受" }));

    await waitFor(() => {
      expect(screen.getByText("加入失败：网络错误")).toBeTruthy();
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
