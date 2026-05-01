import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { uploadAndSendFileMock } = vi.hoisted(() => ({
  uploadAndSendFileMock: vi.fn().mockResolvedValue("$ev1"),
}));

vi.mock("@magic/matrix-client", () => ({
  uploadAndSendFile: uploadAndSendFileMock,
}));

import { useFileUpload } from "../../src/hooks/useFileUpload.js";

const ROOM_ID = "!room:example.com";

function makeFile(name = "test.txt", type = "text/plain"): File {
  return new File(["hello"], name, { type });
}

beforeEach(() => {
  uploadAndSendFileMock.mockClear();
  uploadAndSendFileMock.mockResolvedValue("$ev1");
});

describe("useFileUpload", () => {
  it("starts with empty tasks", () => {
    const { result } = renderHook(() => useFileUpload(ROOM_ID));
    expect(result.current.tasks).toEqual([]);
  });

  it("addFiles appends pending tasks", () => {
    const { result } = renderHook(() => useFileUpload(ROOM_ID));
    act(() => {
      result.current.addFiles([makeFile("a.txt"), makeFile("b.txt")]);
    });
    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks[0].status).toBe("pending");
    expect(result.current.tasks[0].progress).toBe(0);
  });

  it("hasActiveTasks reflects pending tasks", () => {
    const { result } = renderHook(() => useFileUpload(ROOM_ID));
    expect(result.current.hasActiveTasks).toBe(false);
    act(() => {
      result.current.addFiles([makeFile()]);
    });
    expect(result.current.hasActiveTasks).toBe(true);
  });

  it("removeTask deletes a task by id", () => {
    const { result } = renderHook(() => useFileUpload(ROOM_ID));
    let id = "";
    act(() => {
      const tasks = result.current.addFiles([makeFile()]);
      id = tasks[0].id;
    });
    act(() => result.current.removeTask(id));
    expect(result.current.tasks).toHaveLength(0);
  });

  it("startUpload calls uploadAndSendFile and marks task done", async () => {
    const { result } = renderHook(() => useFileUpload(ROOM_ID));
    act(() => {
      result.current.addFiles([makeFile("a.txt")]);
    });
    await act(async () => {
      await result.current.startUpload();
    });
    expect(uploadAndSendFileMock).toHaveBeenCalledOnce();
    expect(uploadAndSendFileMock.mock.calls[0][0]).toBe(ROOM_ID);
    await waitFor(() => {
      expect(result.current.tasks[0].status).toBe("done");
    });
  });

  it("startUpload propagates progress callbacks", async () => {
    uploadAndSendFileMock.mockImplementationOnce(
      async (_room: string, _file: File, onProgress?: (l: number, t: number) => void) => {
        onProgress?.(50, 100);
        return "$ev1";
      },
    );
    const { result } = renderHook(() => useFileUpload(ROOM_ID));
    act(() => {
      result.current.addFiles([makeFile()]);
    });
    await act(async () => {
      await result.current.startUpload();
    });
    await waitFor(() => {
      expect(result.current.tasks[0].progress).toBe(100);
    });
  });

  it("startUpload handles upload error", async () => {
    uploadAndSendFileMock.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useFileUpload(ROOM_ID));
    act(() => {
      result.current.addFiles([makeFile()]);
    });
    await act(async () => {
      await result.current.startUpload();
    });
    await waitFor(() => {
      expect(result.current.tasks[0].status).toBe("error");
    });
    expect(result.current.tasks[0].error).toBe("network");
  });

  it("cancelTask marks task cancelled", () => {
    const { result } = renderHook(() => useFileUpload(ROOM_ID));
    let id = "";
    act(() => {
      const tasks = result.current.addFiles([makeFile()]);
      id = tasks[0].id;
    });
    act(() => result.current.cancelTask(id));
    expect(result.current.tasks[0].status).toBe("cancelled");
  });

  it("clearCompleted keeps only pending and uploading tasks", () => {
    const { result } = renderHook(() => useFileUpload(ROOM_ID));
    act(() => {
      result.current.addFiles([makeFile("a.txt")]);
    });
    let secondId = "";
    act(() => {
      const t = result.current.addFiles([makeFile("b.txt")]);
      secondId = t[0].id;
    });
    act(() => result.current.cancelTask(secondId));
    act(() => result.current.clearCompleted());
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.tasks[0].file.name).toBe("a.txt");
  });
});
