import { describe, it, expect } from "vitest";
import { injectMentionLinks } from "../../src/chat/TextMessage.js";

const ALICE = { userId: "@alice:example.com", displayName: "alice" };
const MANAGER = { userId: "@manager:example.com", displayName: "manager 💕" };

describe("injectMentionLinks", () => {
  it("returns body unchanged when no mention sources match", () => {
    expect(injectMentionLinks("hello world", undefined, [])).toBe("hello world");
  });

  it("rewrites a plain @alice mention into a markdown link", () => {
    const out = injectMentionLinks("hi @alice please", undefined, [ALICE]);
    expect(out).toBe(
      "hi [alice](https://matrix.to/#/%40alice%3Aexample.com) please",
    );
  });

  it("rewrites @manager 💕 with a multi-token display name", () => {
    const out = injectMentionLinks(
      "@manager 💕 把小爱启动起来",
      undefined,
      [MANAGER],
    );
    expect(out).toBe(
      "[manager 💕](https://matrix.to/#/%40manager%3Aexample.com) 把小爱启动起来",
    );
  });

  it("does not match @ inside an email address", () => {
    const out = injectMentionLinks("ping me at me@example.com", undefined, [
      { userId: "@example.com:foo", displayName: "example.com" },
    ]);
    expect(out).toBe("ping me at me@example.com");
  });

  it("does not match a partial name followed by alphanumeric", () => {
    // "@alicia" should NOT match the "alice" member.
    const out = injectMentionLinks("hi @alicia", undefined, [ALICE]);
    expect(out).toBe("hi @alicia");
  });

  it("matches longest member name first when prefixes collide", () => {
    const a = { userId: "@a:x", displayName: "alice" };
    const b = { userId: "@b:x", displayName: "alice_two" };
    const out = injectMentionLinks("hi @alice_two there", undefined, [a, b]);
    expect(out).toContain("[alice_two]");
    expect(out).not.toContain("[alice](");
  });

  it("merges anchor mentions from formatted_body with member fallback", () => {
    const formatted =
      'hi <a href="https://matrix.to/#/%40bob%3Aexample.com">bob</a> and @alice';
    const out = injectMentionLinks(
      "hi @bob and @alice",
      formatted,
      [ALICE],
    );
    expect(out).toContain("[bob](");
    expect(out).toContain("[alice](");
  });

  it("strips a leading @ from anchor text in formatted_body", () => {
    const formatted =
      'hi <a href="https://matrix.to/#/%40alice%3Aexample.com">@alice</a>';
    const out = injectMentionLinks("hi @alice", formatted, []);
    // Link text should be "alice" (no @), MentionPill prepends the @ itself.
    expect(out).toContain("[alice](");
  });
});
