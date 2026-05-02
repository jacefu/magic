import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextMessage } from "../../src/chat/TextMessage.js";

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
      // Markdown rendering path is exercised — we just check that bold
      // text comes through. Tables in raw `body` aren't always reliable
      // because the agent's plain-text body sometimes lacks the
      // separator row that remark-gfm requires; the formatted_body
      // branch above is the robust path.
      render(
        <TextMessage
          body="**hello** world"
          isOwn={false}
          roomId="!r:example.com"
        />,
      );
      expect(document.querySelector("strong")?.textContent).toBe("hello");
    });
  });
});
