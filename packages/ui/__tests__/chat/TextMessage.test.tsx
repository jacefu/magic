import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TextMessage } from "../../src/chat/TextMessage.js";

describe("TextMessage", () => {
  it("renders plain text", () => {
    render(<TextMessage body="Hello world" isOwn={false} />);
    expect(screen.getByText("Hello world")).toBeTruthy();
  });

  it("renders bold markdown", () => {
    render(<TextMessage body="**bold text**" isOwn={false} />);
    const strong = document.querySelector("strong");
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe("bold text");
  });

  it("renders italic markdown", () => {
    render(<TextMessage body="_italic text_" isOwn={false} />);
    const em = document.querySelector("em");
    expect(em).toBeTruthy();
    expect(em?.textContent).toBe("italic text");
  });

  it("renders link with target=_blank", () => {
    render(<TextMessage body="[click](https://example.com)" isOwn={false} />);
    const link = document.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });

  it("renders inline code", () => {
    render(<TextMessage body="use `console.log()`" isOwn={false} />);
    const code = document.querySelector("code");
    expect(code).toBeTruthy();
    expect(code?.textContent).toBe("console.log()");
  });

  it("applies own-message code style when isOwn=true", () => {
    render(<TextMessage body="use `x`" isOwn={true} />);
    const code = document.querySelector("code");
    expect(code?.className).toContain("bg-brand-hover");
  });

  it("applies other-message code style when isOwn=false", () => {
    render(<TextMessage body="use `x`" isOwn={false} />);
    const code = document.querySelector("code");
    expect(code?.className).toContain("bg-bg-modifier");
  });
});
