import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "../../src/chat/MessageBubble.js";
import type { SerializedMatrixEvent } from "@magic/shared-types";

vi.mock("@magic/matrix-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@magic/matrix-client")>();
  return { ...actual, mxcToHttp: vi.fn().mockReturnValue(null) };
});

function makeEvent(overrides: Partial<SerializedMatrixEvent> = {}): SerializedMatrixEvent {
  return {
    eventId: "$ev1",
    roomId: "!room:example.com",
    type: "m.room.message",
    sender: "@alice:example.com",
    content: { msgtype: "m.text", body: "Hello" },
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("MessageBubble", () => {
  it("renders message body text", () => {
    render(
      <MessageBubble
        event={makeEvent({ content: { msgtype: "m.text", body: "Hello world" } })}
        showSender={true}
        isOwn={false}
      />,
    );
    expect(screen.getByText("Hello world")).toBeTruthy();
  });

  it("shows sender name for other's messages with showSender=true", () => {
    render(
      <MessageBubble
        event={makeEvent({ sender: "@bob:example.com" })}
        showSender={true}
        isOwn={false}
      />,
    );
    expect(screen.getByText("bob")).toBeTruthy();
  });

  it("does not show sender name when showSender=false", () => {
    render(
      <MessageBubble
        event={makeEvent({ sender: "@bob:example.com" })}
        showSender={false}
        isOwn={false}
      />,
    );
    expect(screen.queryByText("bob")).toBeNull();
  });

  it("does not show sender name for own messages even with showSender=true", () => {
    render(
      <MessageBubble
        event={makeEvent({ sender: "@me:example.com" })}
        showSender={true}
        isOwn={true}
      />,
    );
    expect(screen.queryByText("me")).toBeNull();
  });

  it("applies blue bg for own messages", () => {
    const { container } = render(
      <MessageBubble event={makeEvent()} showSender={true} isOwn={true} />,
    );
    const bubble = container.querySelector(".rounded-2xl");
    expect(bubble?.className).toContain("bg-magic-primary");
  });

  it("applies gray bg for others' messages", () => {
    const { container } = render(
      <MessageBubble event={makeEvent()} showSender={true} isOwn={false} />,
    );
    const bubble = container.querySelector(".rounded-2xl");
    expect(bubble?.className).toContain("bg-magic-surface-alt");
  });

  it("renders system event as centered text for m.room.member join", () => {
    render(
      <MessageBubble
        event={makeEvent({
          type: "m.room.member",
          content: { membership: "join" },
        })}
        showSender={false}
        isOwn={false}
      />,
    );
    expect(screen.getByText(/加入了房间/)).toBeTruthy();
  });

  it("renders null for unknown system events", () => {
    const { container } = render(
      <MessageBubble
        event={makeEvent({
          type: "m.room.power_levels",
          content: {},
        })}
        showSender={false}
        isOwn={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
