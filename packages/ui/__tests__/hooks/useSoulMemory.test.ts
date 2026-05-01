import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { getSoulContentMock, sendSoulContentMock } = vi.hoisted(() => ({
  getSoulContentMock: vi.fn(),
  sendSoulContentMock: vi.fn().mockResolvedValue("$ev1"),
}));

vi.mock("@magic/matrix-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@magic/matrix-client")>();
  return {
    ...actual,
    getSoulContent: getSoulContentMock,
    sendSoulContent: sendSoulContentMock,
  };
});

import { useAuthStore } from "@magic/matrix-client";
import { useSoulMemory } from "../../src/hooks/useSoulMemory.js";

const ROOM_ID = "!r:example.com";
const USER_ID = "@me:example.com";

beforeEach(() => {
  getSoulContentMock.mockReset();
  sendSoulContentMock.mockReset();
  sendSoulContentMock.mockResolvedValue("$ev1");
  useAuthStore.setState({ userId: USER_ID, homeserver: "h" });
});

describe("useSoulMemory", () => {
  it("loads existing SOUL content from server", async () => {
    getSoulContentMock.mockReturnValueOnce({
      content: "loaded soul",
      file_type: "soul",
      version: 3,
      editor: "@alice:example.com",
    });
    const { result } = renderHook(() =>
      useSoulMemory({ roomId: ROOM_ID, fileType: "soul" }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.savedContent).toBe("loaded soul");
    expect(result.current.editContent).toBe("loaded soul");
    expect(result.current.meta.version).toBe(3);
    expect(result.current.meta.editor).toBe("@alice:example.com");
    expect(result.current.isDirty).toBe(false);
  });

  it("falls back to default SOUL template when server has nothing", async () => {
    getSoulContentMock.mockReturnValueOnce(null);
    const { result } = renderHook(() =>
      useSoulMemory({ roomId: ROOM_ID, fileType: "soul" }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.savedContent).toBe("");
    expect(result.current.editContent).toContain("# SOUL.md");
    // Initial template counts as "dirty" so user can save it directly
    expect(result.current.isDirty).toBe(true);
    expect(result.current.meta.version).toBe(0);
  });

  it("falls back to MEMORY template for fileType=memory", async () => {
    getSoulContentMock.mockReturnValueOnce(null);
    const { result } = renderHook(() =>
      useSoulMemory({ roomId: ROOM_ID, fileType: "memory" }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.editContent).toContain("# MEMORY.md");
  });

  it("setEditContent flips isDirty when content differs from saved", async () => {
    getSoulContentMock.mockReturnValueOnce({
      content: "v1",
      file_type: "soul",
      version: 1,
      editor: USER_ID,
    });
    const { result } = renderHook(() =>
      useSoulMemory({ roomId: ROOM_ID, fileType: "soul" }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.setEditContent("v1 modified"));
    expect(result.current.isDirty).toBe(true);
  });

  it("setEditContent back to saved value clears isDirty", async () => {
    getSoulContentMock.mockReturnValueOnce({
      content: "v1",
      file_type: "soul",
      version: 1,
      editor: USER_ID,
    });
    const { result } = renderHook(() =>
      useSoulMemory({ roomId: ROOM_ID, fileType: "soul" }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setEditContent("changed"));
    act(() => result.current.setEditContent("v1"));
    expect(result.current.isDirty).toBe(false);
  });

  it("save calls sendSoulContent with bumped version", async () => {
    getSoulContentMock.mockReturnValueOnce({
      content: "v1",
      file_type: "soul",
      version: 5,
      editor: "@alice:example.com",
    });
    const { result } = renderHook(() =>
      useSoulMemory({ roomId: ROOM_ID, fileType: "soul" }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setEditContent("v2"));
    await act(async () => {
      await result.current.save();
    });

    expect(sendSoulContentMock).toHaveBeenCalledWith(ROOM_ID, {
      content: "v2",
      file_type: "soul",
      version: 6,
      editor: USER_ID,
    });
    expect(result.current.savedContent).toBe("v2");
    expect(result.current.meta.version).toBe(6);
    expect(result.current.meta.editor).toBe(USER_ID);
    expect(result.current.isDirty).toBe(false);
  });

  it("save records error on failure", async () => {
    getSoulContentMock.mockReturnValueOnce({
      content: "v1",
      file_type: "soul",
      version: 1,
      editor: USER_ID,
    });
    sendSoulContentMock.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() =>
      useSoulMemory({ roomId: ROOM_ID, fileType: "soul" }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setEditContent("v2"));
    await act(async () => {
      await result.current.save();
    });
    expect(result.current.error).toBe("network down");
    expect(result.current.isSaving).toBe(false);
    // editContent should still be the dirty value, savedContent untouched
    expect(result.current.savedContent).toBe("v1");
    expect(result.current.editContent).toBe("v2");
  });

  it("revert restores editContent to savedContent and clears isDirty", async () => {
    getSoulContentMock.mockReturnValueOnce({
      content: "saved",
      file_type: "soul",
      version: 1,
      editor: USER_ID,
    });
    const { result } = renderHook(() =>
      useSoulMemory({ roomId: ROOM_ID, fileType: "soul" }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setEditContent("dirty edit"));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.revert());
    expect(result.current.editContent).toBe("saved");
    expect(result.current.isDirty).toBe(false);
  });

  it("save is a no-op when userId is missing", async () => {
    useAuthStore.setState({ userId: null, homeserver: null });
    getSoulContentMock.mockReturnValueOnce(null);
    const { result } = renderHook(() =>
      useSoulMemory({ roomId: ROOM_ID, fileType: "soul" }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.save();
    });
    expect(sendSoulContentMock).not.toHaveBeenCalled();
  });
});
