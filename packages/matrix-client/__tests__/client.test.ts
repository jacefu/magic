import { describe, it, expect } from "vitest";
import { MATRIX_CLIENT_VERSION } from "../src/index.js";

describe("matrix-client placeholder", () => {
  it("exports version constant", () => {
    expect(MATRIX_CLIENT_VERSION).toBe("0.0.1");
  });
});
