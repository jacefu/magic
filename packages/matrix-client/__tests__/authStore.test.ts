import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../src/stores/authStore.js";

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      stage: "initializing",
      userId: null,
      homeserver: null,
      displayName: null,
      avatarMxc: null,
      error: null,
    });
  });

  it("has initializing as default stage", () => {
    expect(useAuthStore.getState().stage).toBe("initializing");
  });

  it("setStage transitions stage and clears error", () => {
    useAuthStore.setState({ error: "previous error" });
    useAuthStore.getState().setStage("logging_in");
    expect(useAuthStore.getState().stage).toBe("logging_in");
    expect(useAuthStore.getState().error).toBeNull();
  });

  it("setStage to error preserves existing error", () => {
    useAuthStore.setState({ error: "login failed" });
    useAuthStore.getState().setStage("error");
    expect(useAuthStore.getState().stage).toBe("error");
    expect(useAuthStore.getState().error).toBe("login failed");
  });

  it("setError sets error and switches stage to error", () => {
    useAuthStore.getState().setError("用户名或密码错误");
    expect(useAuthStore.getState().error).toBe("用户名或密码错误");
    expect(useAuthStore.getState().stage).toBe("error");
  });

  it("setError with null clears error without changing stage", () => {
    useAuthStore.setState({ stage: "authenticated", error: "some error" });
    useAuthStore.getState().setError(null);
    expect(useAuthStore.getState().error).toBeNull();
    expect(useAuthStore.getState().stage).toBe("authenticated");
  });

  it("setUser updates user fields", () => {
    useAuthStore.getState().setUser({
      userId: "@alice:magic.com",
      homeserver: "https://matrix.magic.com",
      displayName: "Alice",
      avatarMxc: "mxc://magic.com/abc123",
    });
    const state = useAuthStore.getState();
    expect(state.userId).toBe("@alice:magic.com");
    expect(state.homeserver).toBe("https://matrix.magic.com");
    expect(state.displayName).toBe("Alice");
    expect(state.avatarMxc).toBe("mxc://magic.com/abc123");
  });

  it("reset returns to unauthenticated with null fields", () => {
    useAuthStore.setState({
      stage: "authenticated",
      userId: "@alice:magic.com",
      homeserver: "https://matrix.magic.com",
      error: "some error",
    });
    useAuthStore.getState().reset();
    const state = useAuthStore.getState();
    expect(state.stage).toBe("unauthenticated");
    expect(state.userId).toBeNull();
    expect(state.homeserver).toBeNull();
    expect(state.error).toBeNull();
  });

  it("full login flow: logging_in → syncing → authenticated", () => {
    useAuthStore.getState().setStage("logging_in");
    expect(useAuthStore.getState().stage).toBe("logging_in");

    useAuthStore.getState().setUser({ userId: "@bob:magic.com", homeserver: "https://matrix.magic.com" });
    useAuthStore.getState().setStage("syncing");
    expect(useAuthStore.getState().stage).toBe("syncing");

    useAuthStore.getState().setStage("authenticated");
    expect(useAuthStore.getState().stage).toBe("authenticated");
    expect(useAuthStore.getState().error).toBeNull();
  });
});
