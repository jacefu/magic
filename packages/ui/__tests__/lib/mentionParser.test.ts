import { describe, it, expect } from "vitest";
import {
  parseMentions,
  hasMentions,
  extractMentionedUserIds,
} from "../../src/lib/mentionParser.js";

describe("hasMentions", () => {
  it("detects user mention placeholder", () => {
    expect(hasMentions("hi [@alice](@alice:example.com)")).toBe(true);
  });

  it("detects @全体 room mention", () => {
    expect(hasMentions("@全体 attention please")).toBe(true);
  });

  it("returns false for plain text without mentions", () => {
    expect(hasMentions("just a regular message")).toBe(false);
  });

  it("returns false for emails (no closing paren)", () => {
    expect(hasMentions("contact me at user@example.com")).toBe(false);
  });
});

describe("parseMentions", () => {
  it("converts user mention placeholder to body and formatted_body", () => {
    const result = parseMentions("hello [@alice](@alice:example.com) please review");
    expect(result.body).toBe("hello @alice please review");
    expect(result.formattedBody).toContain(
      '<a href="https://matrix.to/#/%40alice%3Aexample.com">alice</a>',
    );
    expect(result.mentions.user_ids).toEqual(["@alice:example.com"]);
  });

  it("dedupes the same userId mentioned twice", () => {
    const result = parseMentions(
      "[@alice](@alice:x) hi [@alice](@alice:x)",
    );
    expect(result.mentions.user_ids).toEqual(["@alice:x"]);
  });

  it("collects multiple distinct mentions", () => {
    const result = parseMentions(
      "[@alice](@alice:x) and [@bob](@bob:x) please sync",
    );
    expect(result.mentions.user_ids).toEqual(["@alice:x", "@bob:x"]);
  });

  it("converts @全体 to @room and sets mentions.room", () => {
    const result = parseMentions("@全体 stand-up in 5");
    expect(result.body).toBe("@room stand-up in 5");
    expect(result.formattedBody).toContain("@room");
    expect(result.mentions.room).toBe(true);
  });

  it("supports user mention + room mention together", () => {
    const result = parseMentions(
      "@全体 and especially [@alice](@alice:x) please",
    );
    expect(result.mentions.room).toBe(true);
    expect(result.mentions.user_ids).toEqual(["@alice:x"]);
  });

  it("returns empty mentions object when input has none", () => {
    const result = parseMentions("just plain text");
    expect(result.body).toBe("just plain text");
    expect(result.mentions).toEqual({});
  });

  it("escapes HTML in display name and surrounding body", () => {
    const result = parseMentions("[@<script>](@x:y) <ok>");
    expect(result.formattedBody).not.toContain("<script>");
    expect(result.formattedBody).toContain("&lt;script&gt;");
    expect(result.formattedBody).toContain("&lt;ok&gt;");
  });

  it("plain body strips placeholder syntax to bare @name", () => {
    const result = parseMentions("[@alice](@alice:server) [@bob](@bob:server)");
    expect(result.body).toBe("@alice @bob");
  });
});

describe("extractMentionedUserIds", () => {
  it("returns empty array for undefined", () => {
    expect(extractMentionedUserIds(undefined)).toEqual([]);
  });

  it("returns userIds from matrix.to anchors", () => {
    const html =
      'hello <a href="https://matrix.to/#/%40alice%3Aexample.com">alice</a> ' +
      'and <a href="https://matrix.to/#/%40bob%3Aexample.com">bob</a>';
    expect(extractMentionedUserIds(html)).toEqual([
      "@alice:example.com",
      "@bob:example.com",
    ]);
  });

  it("ignores non-matrix.to anchors", () => {
    const html = '<a href="https://example.com">link</a>';
    expect(extractMentionedUserIds(html)).toEqual([]);
  });
});
