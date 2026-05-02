import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TextMessage,
  looksLikeHtml,
  normalizeBodyForMarkdown,
} from "../../src/chat/TextMessage.js";

describe("TextMessage", () => {
  it("renders plain text", () => {
    render(<TextMessage body="Hello world" isOwn={false} roomId="!r:example.com" />);
    expect(screen.getByText("Hello world")).toBeTruthy();
  });

  it("renders bold markdown", () => {
    render(<TextMessage body="**bold text**" isOwn={false} roomId="!r:example.com" />);
    const strong = document.querySelector("strong");
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe("bold text");
  });

  it("renders italic markdown", () => {
    render(<TextMessage body="_italic text_" isOwn={false} roomId="!r:example.com" />);
    const em = document.querySelector("em");
    expect(em).toBeTruthy();
    expect(em?.textContent).toBe("italic text");
  });

  it("renders link with target=_blank", () => {
    render(<TextMessage body="[click](https://example.com)" isOwn={false} roomId="!r:example.com" />);
    const link = document.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });

  it("renders inline code", () => {
    render(<TextMessage body="use `console.log()`" isOwn={false} roomId="!r:example.com" />);
    const code = document.querySelector("code");
    expect(code).toBeTruthy();
    expect(code?.textContent).toBe("console.log()");
  });

  it("applies own-message code style when isOwn=true", () => {
    render(<TextMessage body="use `x`" isOwn={true} roomId="!r:example.com" />);
    const code = document.querySelector("code");
    expect(code?.className).toContain("bg-brand-hover");
  });

  it("applies other-message code style when isOwn=false", () => {
    render(<TextMessage body="use `x`" isOwn={false} roomId="!r:example.com" />);
    const code = document.querySelector("code");
    expect(code?.className).toContain("bg-bg-modifier");
  });

  describe("HTML formatted_body branch", () => {
    it("renders an HTML <table> from formatted_body even if body is just plain text", () => {
      const formatted = `<table><thead><tr><th>指标</th><th>数量</th></tr></thead><tbody><tr><td>重要新闻</td><td>3 条</td></tr></tbody></table>`;
      render(
        <TextMessage
          body="| 指标 | 数量 |\n| 重要新闻 | 3 条 |"
          formattedBody={formatted}
          format="org.matrix.custom.html"
          isOwn={false}
          roomId="!r:example.com"
        />,
      );
      expect(document.querySelector("table")).toBeTruthy();
      expect(document.querySelector("th")?.textContent).toBe("指标");
      expect(document.querySelector("td")?.textContent).toBe("重要新闻");
    });

    it("renders <a> from formatted_body as a clickable link with safe attrs", () => {
      const formatted = `Visit <a href="https://www.oschina.net/news/437612">OSChina</a>`;
      render(
        <TextMessage
          body="Visit https://www.oschina.net/news/437612"
          formattedBody={formatted}
          format="org.matrix.custom.html"
          isOwn={false}
          roomId="!r:example.com"
        />,
      );
      const link = document.querySelector("a");
      expect(link?.getAttribute("href")).toBe(
        "https://www.oschina.net/news/437612",
      );
    });

    it("strips <script> tags from formatted_body via the sanitizer", () => {
      const formatted = `Hello<script>window.evil = true;</script> world`;
      render(
        <TextMessage
          body="Hello world"
          formattedBody={formatted}
          format="org.matrix.custom.html"
          isOwn={false}
          roomId="!r:example.com"
        />,
      );
      expect(document.querySelector("script")).toBeNull();
    });

    it("falls back to markdown rendering when formatted_body is absent", () => {
      render(
        <TextMessage
          body="**hello** world"
          isOwn={false}
          roomId="!r:example.com"
        />,
      );
      expect(document.querySelector("strong")?.textContent).toBe("hello");
    });

    it("uses HTML branch even when format header is missing, so long as the body looks like HTML", () => {
      const formatted = "<table><tr><th>x</th></tr></table>";
      render(
        <TextMessage
          body="x"
          formattedBody={formatted}
          // intentionally undefined format
          isOwn={false}
          roomId="!r:example.com"
        />,
      );
      expect(document.querySelector("table")).toBeTruthy();
    });
  });

  describe("looksLikeHtml", () => {
    it("returns false when formatted_body is undefined", () => {
      expect(looksLikeHtml(undefined, undefined)).toBe(false);
    });

    it("returns true when format is org.matrix.custom.html", () => {
      expect(looksLikeHtml("anything", "org.matrix.custom.html")).toBe(true);
    });

    it("returns true on raw HTML even without a format header", () => {
      expect(looksLikeHtml("<p>hi</p>", undefined)).toBe(true);
      expect(looksLikeHtml("<table><tr><td>x</td></tr></table>", undefined))
        .toBe(true);
    });

    it("returns false for plain text without tags", () => {
      expect(looksLikeHtml("just some plain text", undefined)).toBe(false);
    });
  });

  describe("normalizeBodyForMarkdown", () => {
    it("strips a leading BOM", () => {
      expect(normalizeBodyForMarkdown("﻿hello")).toBe("hello");
    });

    it("normalises CRLF to LF", () => {
      expect(normalizeBodyForMarkdown("a\r\nb\r\nc")).toBe("a\nb\nc");
    });

    it("rewrites full-width pipes ｜ to half-width |", () => {
      expect(normalizeBodyForMarkdown("｜ a ｜ b ｜")).toBe("| a | b |");
    });

    it("converts bullet character • lines to '- ' list items", () => {
      const input = "intro\n• item1\n• item2";
      expect(normalizeBodyForMarkdown(input)).toBe(
        "intro\n- item1\n- item2",
      );
    });

    it("preserves indentation when rewriting bullets", () => {
      expect(normalizeBodyForMarkdown("  • nested")).toBe("  - nested");
    });

    it("returns empty string unchanged", () => {
      expect(normalizeBodyForMarkdown("")).toBe("");
    });
  });
});
