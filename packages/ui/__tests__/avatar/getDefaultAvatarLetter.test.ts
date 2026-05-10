import { describe, it, expect } from "vitest";
import { getDefaultAvatarLetter } from "../../src/avatar/getDefaultAvatarLetter.js";

describe("getDefaultAvatarLetter", () => {
  it("英文名取首字母大写", () => {
    expect(getDefaultAvatarLetter("Manager", true)).toBe("M");
    expect(getDefaultAvatarLetter("alice", false)).toBe("A");
  });

  it("中文名取拼音首字母", () => {
    expect(getDefaultAvatarLetter("岛风", false)).toBe("D");
    expect(getDefaultAvatarLetter("李明", false)).toBe("L");
    expect(getDefaultAvatarLetter("张三", true)).toBe("Z");
    expect(getDefaultAvatarLetter("王小二", false)).toBe("W");
  });

  it("数字开头：Agent 用 A，真人用 H", () => {
    expect(getDefaultAvatarLetter("123agent", true)).toBe("A");
    expect(getDefaultAvatarLetter("123user", false)).toBe("H");
  });

  it("空字符串 fallback 正确", () => {
    expect(getDefaultAvatarLetter("", true)).toBe("A");
    expect(getDefaultAvatarLetter("", false)).toBe("H");
    expect(getDefaultAvatarLetter("   ", true)).toBe("A");
  });

  it("emoji 开头 fallback 到 userId", () => {
    expect(
      getDefaultAvatarLetter("💕manager", true, "@manager:server"),
    ).toBe("M");
    expect(getDefaultAvatarLetter("💕", false, "@xiaoai:server")).toBe("X");
    // 都没有 → fallback
    expect(getDefaultAvatarLetter("💕", true)).toBe("A");
    expect(getDefaultAvatarLetter("💕", false)).toBe("H");
  });

  it("真实使用场景", () => {
    expect(getDefaultAvatarLetter("manager 💕", true)).toBe("M");
    expect(getDefaultAvatarLetter("Worker: JFK_Defense", true)).toBe("W");
    expect(getDefaultAvatarLetter("admin", false)).toBe("A");
  });
});
