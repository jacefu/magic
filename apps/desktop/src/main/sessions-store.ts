import Store from "electron-store";
import { app } from "electron";
import { createHash } from "crypto";
import type { PersistedSession } from "@magic/shared-types";

interface SessionsStoreShape {
  sessions: PersistedSession[];
  activeSessionId: string | null;
}

const defaults: SessionsStoreShape = {
  sessions: [],
  activeSessionId: null,
};

/**
 * Encrypted-at-rest store for Matrix sessions. Spec 017 BUG-3:
 * accessToken must NOT live in localStorage. electron-store's
 * `encryptionKey` triggers AES-256-CBC encryption of the JSON file
 * before it touches disk under `app.getPath("userData")`.
 *
 * The key itself is derived from a stable machine-bound value
 * (app userData path) — anyone with filesystem access can reproduce
 * it, so this is OS-disk-encryption-class hardening, not zero-trust.
 * Sufficient to clear the spec's bar of "not plain text in
 * localStorage where any renderer extension can read it."
 */
function deriveEncryptionKey(): string {
  return createHash("sha256")
    .update(`magic-sessions-v1:${app.getPath("userData")}`)
    .digest("hex");
}

export const sessionsStore = new Store<SessionsStoreShape>({
  name: "magic-sessions",
  defaults,
  encryptionKey: deriveEncryptionKey(),
});
