import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../../src/stores/uiStore.js";

beforeEach(() => {
  useUIStore.getState().reset();
});

describe("uiStore — composer insert", () => {
  it("starts with no pending insert request", () => {
    expect(useUIStore.getState().composerInsertRequest).toBeNull();
  });

  it("requestComposerInsert publishes the text with version=1", () => {
    useUIStore.getState().requestComposerInsert("@alice ");
    const req = useUIStore.getState().composerInsertRequest;
    expect(req?.text).toBe("@alice ");
    expect(req?.version).toBe(1);
  });

  it("repeated requestComposerInsert increments version (so consumers re-fire)", () => {
    useUIStore.getState().requestComposerInsert("@alice ");
    useUIStore.getState().requestComposerInsert("@bob ");
    const req = useUIStore.getState().composerInsertRequest;
    expect(req?.text).toBe("@bob ");
    expect(req?.version).toBe(2);
  });

  it("identical text bumps version too — clicking the same name twice still fires", () => {
    useUIStore.getState().requestComposerInsert("@alice ");
    const v1 = useUIStore.getState().composerInsertRequest?.version;
    useUIStore.getState().requestComposerInsert("@alice ");
    const v2 = useUIStore.getState().composerInsertRequest?.version;
    expect(v2).toBe((v1 ?? 0) + 1);
  });

  it("consumeComposerInsert clears the pending request", () => {
    useUIStore.getState().requestComposerInsert("hi");
    useUIStore.getState().consumeComposerInsert();
    expect(useUIStore.getState().composerInsertRequest).toBeNull();
  });

  it("reset clears any pending request", () => {
    useUIStore.getState().requestComposerInsert("hi");
    useUIStore.getState().reset();
    expect(useUIStore.getState().composerInsertRequest).toBeNull();
  });
});

describe("uiStore — right panel + reply", () => {
  it("setRightPanel opens with the given mode", () => {
    useUIStore.getState().setRightPanel("members");
    const s = useUIStore.getState();
    expect(s.rightPanelOpen).toBe(true);
    expect(s.rightPanelMode).toBe("members");
  });

  it("closeRightPanel resets open + mode", () => {
    useUIStore.getState().setRightPanel("members");
    useUIStore.getState().closeRightPanel();
    const s = useUIStore.getState();
    expect(s.rightPanelOpen).toBe(false);
    expect(s.rightPanelMode).toBeNull();
  });

  it("setComposerReplyTo updates the field", () => {
    useUIStore.getState().setComposerReplyTo("$ev1");
    expect(useUIStore.getState().composerReplyTo).toBe("$ev1");
  });
});
