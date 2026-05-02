import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  TextMessage,
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

  it("renders link with target=_blank and brand colour", () => {
    render(
      <TextMessage
        body="[click](https://example.com)"
        isOwn={false}
        roomId="!r:example.com"
      />,
    );
    const link = document.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(link?.className).toContain("text-[#00A8FC]");
  });

  it("auto-links bare URLs in body", () => {
    render(
      <TextMessage
        body="see https://www.oschina.net/news/437612 for details"
        isOwn={false}
        roomId="!r:example.com"
      />,
    );
    const link = document.querySelector("a");
    expect(link?.getAttribute("href")).toBe(
      "https://www.oschina.net/news/437612",
    );
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

  it("does NOT leak the raw `node` AST prop onto rendered <code>", () => {
    render(<TextMessage body="hi `x` end" isOwn={false} roomId="!r:example.com" />);
    const code = document.querySelector("code");
    expect(code?.getAttribute("node")).toBeNull();
  });

  describe("tables", () => {
    it("renders GFM markdown tables from body with bordered styling", () => {
      const md = "| 类型 | 数量 |\n| --- | --- |\n| 重要 | 3 条 |\n| 普通 | 5 条 |";
      render(
        <TextMessage body={md} isOwn={false} roomId="!r:example.com" />,
      );
      const table = document.querySelector("table");
      expect(table).toBeTruthy();
      expect(table?.className).toContain("border-collapse");
      expect(document.querySelectorAll("th")).toHaveLength(2);
      expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
    });

    it("inserts a blank line before a table glued to the previous paragraph", () => {
      // No blank line between "汇总" and the header row — normalizer
      // should still let remark-gfm find the table.
      const md = "汇总\n| a | b |\n| --- | --- |\n| 1 | 2 |";
      render(
        <TextMessage body={md} isOwn={false} roomId="!r:example.com" />,
      );
      expect(document.querySelector("table")).toBeTruthy();
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

    it("inserts a blank line before a markdown table that follows text directly", () => {
      const out = normalizeBodyForMarkdown("汇总\n| a | b |\n| --- | --- |");
      expect(out).toBe("汇总\n\n| a | b |\n| --- | --- |");
    });

    it("returns empty string unchanged", () => {
      expect(normalizeBodyForMarkdown("")).toBe("");
    });
  });
});
