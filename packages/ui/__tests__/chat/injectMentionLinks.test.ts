import { describe, it, expect } from "vitest";
import { injectMentionLinks } from "../../src/chat/TextMessage.js";

const ALICE = { userId: "@alice:example.com", displayName: "alice" };
const MANAGER = { userId: "@manager:example.com", displayName: "manager 💕" };

describe("injectMentionLinks", () => {
  it("returns body unchanged when there are no members", () => {
    expect(injectMentionLinks("hello world", [])).toBe("hello world");
  });

  it("rewrites a plain @alice mention into a markdown link", () => {
    const out = injectMentionLinks("hi @alice please", [ALICE]);
    expect(out).toBe(
      "hi [alice](https://matrix.to/#/%40alice%3Aexample.com) please",
    );
  });

  it("rewrites @manager 💕 with a multi-token display name", () => {
    const out = injectMentionLinks("@manager 💕 把小爱启动起来", [MANAGER]);
    expect(out).toBe(
      "[manager 💕](https://matrix.to/#/%40manager%3Aexample.com) 把小爱启动起来",
    );
  });

  it("does not match @ inside an email address", () => {
    const out = injectMentionLinks("ping me at me@example.com", [
      { userId: "@example.com:foo", displayName: "example.com" },
    ]);
    expect(out).toBe("ping me at me@example.com");
  });

  it("does not match a partial name followed by alphanumeric", () => {
    // "@alicia" should NOT match the "alice" member.
    const out = injectMentionLinks("hi @alicia", [ALICE]);
    expect(out).toBe("hi @alicia");
  });

  it("matches longest member name first when prefixes collide", () => {
    const a = { userId: "@a:x", displayName: "alice" };
    const b = { userId: "@b:x", displayName: "alice_two" };
    const out = injectMentionLinks("hi @alice_two there", [a, b]);
    expect(out).toContain("[alice_two]");
    expect(out).not.toContain("[alice](");
  });

  it("rewrites a mention at the start of the body", () => {
    expect(injectMentionLinks("@alice hi", [ALICE])).toBe(
      "[alice](https://matrix.to/#/%40alice%3Aexample.com) hi",
    );
  });

  it("leaves the body untouched when no member name matches", () => {
    expect(injectMentionLinks("hi @bob", [ALICE])).toBe("hi @bob");
  });
});
