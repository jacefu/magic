/**
 * Tiny localStorage-backed history of "Magic instances I've signed
 * into before". Used by the WelcomePage quick-connect list — survives
 * logout (and thus an empty session list), unlike the encrypted
 * sessions blob which is wiped when the last session is removed.
 *
 * No tokens or secrets — only the homeserver URL, the last-used
 * username, and display chrome (name/initial/color/icon). Plain
 * localStorage is fine.
 */

const LS_KEY = "magic_recent_instances";
const MAX_ENTRIES = 5;

export interface RecentInstance {
  url: string;
  username: string;
  name: string;
  initial: string;
  color: string;
  iconDataUrl?: string | null;
  lastUsedAt: number;
}

export function getRecentInstances(): RecentInstance[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RecentInstance[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.url === "string")
      .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
  } catch {
    return [];
  }
}

export function recordInstanceLogin(entry: Omit<RecentInstance, "lastUsedAt">): void {
  if (typeof localStorage === "undefined") return;
  const existing = getRecentInstances().filter(
    (e) => normalizeUrl(e.url) !== normalizeUrl(entry.url),
  );
  const next: RecentInstance[] = [
    { ...entry, lastUsedAt: Date.now() },
    ...existing,
  ].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* quota — ignore */
  }
}

export function removeRecentInstance(url: string): void {
  if (typeof localStorage === "undefined") return;
  const next = getRecentInstances().filter(
    (e) => normalizeUrl(e.url) !== normalizeUrl(url),
  );
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}
