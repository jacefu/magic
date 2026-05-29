import { describe, it, expect } from "vitest";
import { splitToolCallSegments } from "../../src/chat/parseToolCalls.js";

describe("splitToolCallSegments", () => {
  it("returns a single md segment when no tool calls are present", () => {
    const body = "hello\nworld\n\nplain markdown here";
    const segs = splitToolCallSegments(body);
    expect(segs).toEqual([{ type: "md", content: body }]);
  });

  it("folds a wrench-prefixed tool call into a tools segment", () => {
    const body = "🔧 memory_search\n```json\n{\"query\": \"a\"}\n```";
    const segs = splitToolCallSegments(body);
    expect(segs).toHaveLength(1);
    expect(segs[0].type).toBe("tools");
    if (segs[0].type === "tools") {
      expect(segs[0].calls).toEqual([
        { name: "memory_search", language: "json", args: '{"query": "a"}' },
      ]);
    }
  });

  it("folds a magic-wand-prefixed tool call (different emoji than wrench)", () => {
    const body = "🪄 projectflow\n```json\n{\"action\": \"create\"}\n```";
    const segs = splitToolCallSegments(body);
    expect(segs).toHaveLength(1);
    expect(segs[0].type).toBe("tools");
    if (segs[0].type === "tools") {
      expect(segs[0].calls[0].name).toBe("projectflow");
    }
  });

  it("folds a hammer-and-wrench (🛠️ composite emoji with VS-16)", () => {
    const body = "🛠️ filesync\n```json\n{\"path\": \"/a\"}\n```";
    const segs = splitToolCallSegments(body);
    expect(segs).toHaveLength(1);
    expect(segs[0].type).toBe("tools");
    if (segs[0].type === "tools") {
      expect(segs[0].calls[0].name).toBe("filesync");
    }
  });

  it("groups consecutive tool calls into one tools segment", () => {
    const body =
      "🔧 a\n```json\n{}\n```\n\n🪄 b\n```json\n{}\n```\n\n🛠️ c\n```json\n{}\n```";
    const segs = splitToolCallSegments(body);
    expect(segs).toHaveLength(1);
    expect(segs[0].type).toBe("tools");
    if (segs[0].type === "tools") {
      expect(segs[0].calls.map((c) => c.name)).toEqual(["a", "b", "c"]);
    }
  });

  it("interleaves prose between tool batches", () => {
    const body =
      "preamble\n\n🔧 a\n```json\n{}\n```\n\nmiddle prose\n\n🔧 b\n```json\n{}\n```\n\nfinal note";
    const segs = splitToolCallSegments(body);
    expect(segs.map((s) => s.type)).toEqual([
      "md",
      "tools",
      "md",
      "tools",
      "md",
    ]);
  });

  it("does NOT match a plain identifier without emoji prefix", () => {
    const body = "hello\n```json\n{}\n```";
    const segs = splitToolCallSegments(body);
    expect(segs).toEqual([{ type: "md", content: body }]);
  });

  it("does NOT match heading + identifier without emoji prefix", () => {
    const body = "### plainHeading\n```json\n{}\n```";
    const segs = splitToolCallSegments(body);
    expect(segs).toEqual([{ type: "md", content: body }]);
  });
});
