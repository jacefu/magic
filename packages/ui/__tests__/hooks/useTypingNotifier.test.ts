import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { sendTypingMock } = vi.hoisted(() => ({
  sendTypingMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@magic/matrix-client", () => ({
  sendTyping: sendTypingMock,
}));

import { useTypingNotifier } from "../../src/hooks/useTypingNotifier.js";

const ROOM_ID = "!room:example.com";

beforeEach(() => {
  vi.useFakeTimers();
  sendTypingMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useTypingNotifier", () => {
  it("sends typing=true on first call", () => {
    const { result } = renderHook(() => useTypingNotifier(ROOM_ID));
    act(() => result.current.notifyTyping());
    expect(sendTypingMock).toHaveBeenCalledWith(ROOM_ID, true);
  });

  it("throttles repeated notifyTyping calls within 10s", () => {
    const { result } = renderHook(() => useTypingNotifier(ROOM_ID));
    act(() => result.current.notifyTyping());
    act(() => result.current.notifyTyping());
    act(() => result.current.notifyTyping());
    // Only one typing=true should fire (subsequent calls are throttled)
    const trueCalls = sendTypingMock.mock.calls.filter((c) => c[1] === true);
    expect(trueCalls).toHaveLength(1);
  });

  it("re-sends typing=true after 10s elapsed", () => {
    const { result } = renderHook(() => useTypingNotifier(ROOM_ID));
    act(() => result.current.notifyTyping());
    act(() => vi.advanceTimersByTime(10_001));
    act(() => result.current.notifyTyping());
    const trueCalls = sendTypingMock.mock.calls.filter((c) => c[1] === true);
    expect(trueCalls).toHaveLength(2);
  });

  it("sends typing=false 5s after last keystroke", () => {
    const { result } = renderHook(() => useTypingNotifier(ROOM_ID));
    act(() => result.current.notifyTyping());
    act(() => vi.advanceTimersByTime(5_000));
    expect(sendTypingMock).toHaveBeenCalledWith(ROOM_ID, false);
  });

  it("stopTyping immediately sends typing=false when currently typing", () => {
    const { result } = renderHook(() => useTypingNotifier(ROOM_ID));
    act(() => result.current.notifyTyping());
    sendTypingMock.mockClear();
    act(() => result.current.stopTyping());
    expect(sendTypingMock).toHaveBeenCalledWith(ROOM_ID, false);
  });

  it("stopTyping is a no-op when not currently typing", () => {
    const { result } = renderHook(() => useTypingNotifier(ROOM_ID));
    act(() => result.current.stopTyping());
    expect(sendTypingMock).not.toHaveBeenCalled();
  });

  it("sends typing=false on unmount if was typing", () => {
    const { result, unmount } = renderHook(() => useTypingNotifier(ROOM_ID));
    act(() => result.current.notifyTyping());
    sendTypingMock.mockClear();
    unmount();
    expect(sendTypingMock).toHaveBeenCalledWith(ROOM_ID, false);
  });
});
