import { describe, expect, it } from "vitest";
import { createSessionId } from "../src/session-manager.js";

describe("createSessionId", () => {
  it("returns a stable id for the same homeserver URL", () => {
    expect(createSessionId("https://matrix.org")).toBe(
      createSessionId("https://matrix.org"),
    );
  });

  it("differs when the homeserver URL differs", () => {
    expect(createSessionId("https://matrix.org")).not.toBe(
      createSessionId("https://matrix-local.hiclaw.io:18080"),
    );
  });

  it("treats trailing path differences as different ids", () => {
    expect(createSessionId("https://matrix.org")).not.toBe(
      createSessionId("https://matrix.org/"),
    );
  });

  it("emits a string starting with `session_`", () => {
    expect(createSessionId("https://matrix.org")).toMatch(/^session_/);
  });
});
