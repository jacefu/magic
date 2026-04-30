import { describe, it, expect } from "vitest";
import { Placeholder } from "../src/index.js";

describe("Placeholder", () => {
  it("is a function component", () => {
    expect(typeof Placeholder).toBe("function");
  });

  it("has correct display name", () => {
    expect(Placeholder.name).toBe("Placeholder");
  });
});
