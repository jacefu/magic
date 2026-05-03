import type { PersistedSession } from "@magic/shared-types";

const LEGACY_LS_KEY = "magic_sessions";
const ENCRYPTED_LS_KEY = "magic_sessions_v2";
const ACTIVE_LS_KEY = "magic_active_session";
const KEY_DB_NAME = "magic_keystore";
const KEY_DB_STORE = "keys";
const KEY_NAME = "magic_session_key";

/** Shape persisted to disk on top of the session list. */
export interface PersistedSessionEnvelope {
  sessions: PersistedSession[];
  activeSessionId: string | null;
}

interface ElectronAPI {
  saveSessions?: (sessions: PersistedSession[]) => Promise<void>;
  loadSessions?: () => Promise<PersistedSession[]>;
}

/**
 * Spec 017 BUG-3: accessToken must not sit in plaintext localStorage.
 *
 * - Electron renderer talks to the main process (`sessions:save` /
 *   `sessions:load`), which writes to an electron-store file encrypted
 *   with a machine-derived AES-256-CBC key under userData.
 * - Browsers use Web Crypto AES-GCM with a non-extractable key kept in
 *   IndexedDB; the ciphertext (with prepended IV) goes into localStorage.
 *
 * Fallback: insecure contexts (HTTP, localhost without crypto.subtle)
 * fall back to plain localStorage, since the alternative is to lose
 * sessions on every reload — preferable for dev, never reached in prod.
 */
export async function savePersistedSessions(
  sessions: PersistedSession[],
  activeSessionId: string | null,
): Promise<void> {
  const electronAPI = getElectronAPI();
  if (electronAPI?.saveSessions) {
    try {
      await electronAPI.saveSessions(sessions);
    } catch {
      /* best-effort */
    }
    persistActiveLocally(activeSessionId);
    return;
  }

  if (typeof localStorage === "undefined") return;
  const envelope: PersistedSessionEnvelope = {
    sessions,
    activeSessionId,
  };
  const json = JSON.stringify(envelope);

  try {
    if (canUseWebCrypto()) {
      const encrypted = await encryptString(json);
      localStorage.setItem(ENCRYPTED_LS_KEY, encrypted);
      localStorage.removeItem(LEGACY_LS_KEY);
      return;
    }
  } catch {
    /* fall through to plaintext */
  }

  // Insecure fallback (dev/localhost without subtle crypto).
  localStorage.setItem(LEGACY_LS_KEY, json);
}

export async function loadPersistedSessions(): Promise<PersistedSessionEnvelope> {
  const electronAPI = getElectronAPI();
  if (electronAPI?.loadSessions) {
    try {
      const sessions = (await electronAPI.loadSessions()) ?? [];
      const activeSessionId = readActiveLocally();
      return { sessions, activeSessionId };
    } catch {
      return { sessions: [], activeSessionId: null };
    }
  }

  if (typeof localStorage === "undefined") {
    return { sessions: [], activeSessionId: null };
  }

  // Try the encrypted v2 store first.
  const encrypted = localStorage.getItem(ENCRYPTED_LS_KEY);
  if (encrypted) {
    try {
      const json = await decryptString(encrypted);
      return parseEnvelope(json);
    } catch {
      // Corrupted ciphertext or missing key — drop the bucket so we
      // don't trip over it on every load.
      localStorage.removeItem(ENCRYPTED_LS_KEY);
    }
  }

  // Migrate from legacy plaintext store.
  const legacy = localStorage.getItem(LEGACY_LS_KEY);
  if (legacy) {
    const envelope = parseEnvelope(legacy);
    // Best-effort upgrade: rewrite under the encrypted key.
    if (canUseWebCrypto()) {
      try {
        const reencrypted = await encryptString(JSON.stringify(envelope));
        localStorage.setItem(ENCRYPTED_LS_KEY, reencrypted);
        localStorage.removeItem(LEGACY_LS_KEY);
      } catch {
        /* leave legacy in place */
      }
    }
    return envelope;
  }

  return { sessions: [], activeSessionId: null };
}

function getElectronAPI(): ElectronAPI | null {
  if (typeof window === "undefined") return null;
  const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
  return api ?? null;
}

function persistActiveLocally(activeSessionId: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (activeSessionId) localStorage.setItem(ACTIVE_LS_KEY, activeSessionId);
  else localStorage.removeItem(ACTIVE_LS_KEY);
}

function readActiveLocally(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(ACTIVE_LS_KEY);
}

function parseEnvelope(raw: string): PersistedSessionEnvelope {
  try {
    const parsed = JSON.parse(raw) as
      | PersistedSessionEnvelope
      | PersistedSession[];
    if (Array.isArray(parsed)) {
      return { sessions: parsed, activeSessionId: null };
    }
    return {
      sessions: parsed.sessions ?? [],
      activeSessionId: parsed.activeSessionId ?? null,
    };
  } catch {
    return { sessions: [], activeSessionId: null };
  }
}

function canUseWebCrypto(): boolean {
  return (
    typeof crypto !== "undefined" &&
    typeof crypto.subtle !== "undefined" &&
    typeof indexedDB !== "undefined"
  );
}

// ---- Web Crypto AES-GCM ----

async function encryptString(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded),
  );
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return base64Encode(combined);
}

async function decryptString(encrypted: string): Promise<string> {
  const key = await getOrCreateKey();
  const combined = base64Decode(encrypted);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const existing = await idbGet(KEY_NAME);
  if (existing instanceof CryptoKey) return existing;

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // non-extractable
    ["encrypt", "decrypt"],
  );
  await idbPut(KEY_NAME, key);
  return key;
}

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(KEY_DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<unknown> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_DB_STORE, "readonly");
    const req = tx.objectStore(KEY_DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_DB_STORE, "readwrite");
    tx.objectStore(KEY_DB_STORE).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
