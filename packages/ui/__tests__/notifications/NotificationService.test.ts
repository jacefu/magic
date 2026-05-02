import { describe, it, expect, beforeEach } from "vitest";
import type { SerializedMatrixEvent } from "@magic/shared-types";
import {
  evaluateShouldNotify,
  isMentionedInEvent,
  type NotificationDecisionContext,
} from "../../src/notifications/NotificationService.js";

const ME = "@me:example.com";
const ALICE = "@alice:example.com";
const ROOM = "!r:example.com";

function makeEvent(
  overrides: Partial<SerializedMatrixEvent> = {},
): SerializedMatrixEvent {
  return {
    eventId: "$ev",
    roomId: ROOM,
    type: "m.room.message",
    sender: ALICE,
    content: { msgtype: "m.text", body: "hi there" },
    timestamp: Date.now(),
    ...overrides,
  };
}

function defaultCtx(
  overrides: Partial<NotificationDecisionContext> = {},
): NotificationDecisionContext {
  return {
    currentUserId: ME,
    activeRoomId: null,
    windowFocused: false,
    level: "all",
    dnd: false,
    isRoomMuted: () => false,
    ...overrides,
  };
}

let ctx: NotificationDecisionContext;

beforeEach(() => {
  ctx = defaultCtx();
});

describe("evaluateShouldNotify", () => {
  describe("event-type filters", () => {
    it("returns null for non-message events", () => {
      const e = makeEvent({ type: "m.reaction" });
      expect(evaluateShouldNotify(e, ctx)).toBeNull();
    });

    it("returns null when the event is from the current user (own echo)", () => {
      const e = makeEvent({ sender: ME });
      expect(evaluateShouldNotify(e, ctx)).toBeNull();
    });
  });

  describe("global suppressions", () => {
    it("DND suppresses everything, including @mentions", () => {
      ctx.dnd = true;
      const e = makeEvent({
        content: {
          msgtype: "m.text",
          body: "@me hi",
          "m.mentions": { user_ids: [ME] },
        },
      });
      expect(evaluateShouldNotify(e, ctx)).toBeNull();
    });

    it("level=mute suppresses everything", () => {
      ctx.level = "mute";
      expect(evaluateShouldNotify(makeEvent(), ctx)).toBeNull();
    });

    it("muted room suppresses notifications", () => {
      ctx.isRoomMuted = (id) => id === ROOM;
      expect(evaluateShouldNotify(makeEvent(), ctx)).toBeNull();
    });

    it("active focused room suppresses (you're already looking)", () => {
      ctx.activeRoomId = ROOM;
      ctx.windowFocused = true;
      expect(evaluateShouldNotify(makeEvent(), ctx)).toBeNull();
    });

    it("active room but window UNfocused → still notify", () => {
      ctx.activeRoomId = ROOM;
      ctx.windowFocused = false;
      expect(evaluateShouldNotify(makeEvent(), ctx)).toBe("normal");
    });
  });

  describe("level=mentions filter", () => {
    beforeEach(() => {
      ctx.level = "mentions";
    });

    it("plain message → no notification", () => {
      expect(evaluateShouldNotify(makeEvent(), ctx)).toBeNull();
    });

    it("explicit @mention via m.mentions → 'mention'", () => {
      const e = makeEvent({
        content: {
          msgtype: "m.text",
          body: "@me hi",
          "m.mentions": { user_ids: [ME] },
        },
      });
      expect(evaluateShouldNotify(e, ctx)).toBe("mention");
    });

    it("@room broadcast → 'mention'", () => {
      const e = makeEvent({
        content: {
          msgtype: "m.text",
          body: "@room ping",
          "m.mentions": { room: true },
        },
      });
      expect(evaluateShouldNotify(e, ctx)).toBe("mention");
    });
  });

  describe("level=all", () => {
    it("plain message → 'normal'", () => {
      expect(evaluateShouldNotify(makeEvent(), ctx)).toBe("normal");
    });

    it("@mention → 'mention'", () => {
      const e = makeEvent({
        content: {
          msgtype: "m.text",
          body: "@me hi",
          "m.mentions": { user_ids: [ME] },
        },
      });
      expect(evaluateShouldNotify(e, ctx)).toBe("mention");
    });
  });
});

describe("isMentionedInEvent", () => {
  it("detects via m.mentions.user_ids", () => {
    const e = makeEvent({
      content: { body: "x", "m.mentions": { user_ids: [ME] } },
    });
    expect(isMentionedInEvent(e, ME)).toBe(true);
  });

  it("detects via m.mentions.room (room broadcast)", () => {
    const e = makeEvent({
      content: { body: "x", "m.mentions": { room: true } },
    });
    expect(isMentionedInEvent(e, ME)).toBe(true);
  });

  it("falls back to body-substring scan when m.mentions is absent", () => {
    const e = makeEvent({ content: { body: "hey @me how's it" } });
    expect(isMentionedInEvent(e, ME)).toBe(true);
  });

  it("returns false when neither structured nor body-scan matches", () => {
    const e = makeEvent({ content: { body: "hey alice" } });
    expect(isMentionedInEvent(e, ME)).toBe(false);
  });

  it("returns false when userId is null", () => {
    const e = makeEvent({
      content: { body: "x", "m.mentions": { user_ids: [ME] } },
    });
    expect(isMentionedInEvent(e, null)).toBe(false);
  });
});
