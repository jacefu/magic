import { getClient, hasClient } from "@magic/matrix-client";

export type OnlineStatus = "online" | "idle" | "offline";

/**
 * Read a user's online status straight from matrix-js-sdk's `User` object.
 * The SDK already maintains presence via `/sync` — no extra subscription
 * or store is needed. Works the same way for humans and Agents because
 * an Agent is itself a Matrix client kept alive by its container's sync
 * loop (and stops being "online" the instant `hiclaw worker sleep`
 * terminates that loop).
 */
export function getUserPresence(userId: string): OnlineStatus {
  if (!hasClient()) return "offline";
  try {
    const user = getClient().getUser(userId);
    if (!user) return "offline";

    switch (user.presence) {
      case "online":
        return "online";
      case "unavailable":
        return "idle";
      case "busy":
        return "online";
      case "offline":
      default:
        return "offline";
    }
  } catch {
    return "offline";
  }
}

// Spec § 7.7 + § 11 — presence dot colors resolve to CSS variables so
// they adapt to dark / light theme automatically. Pair with the
// matching glow tokens (`var(--glow-success)` etc.) when rendering.
export function getPresenceColor(status: OnlineStatus): string {
  switch (status) {
    case "online":
      return "var(--color-success)";
    case "idle":
      return "var(--color-warning)";
    case "offline":
      return "var(--offline-dot)";
  }
}

/** Companion to {@link getPresenceColor} — returns the matching glow
 *  shadow so callers don't have to maintain a parallel switch. Pass
 *  the result straight to `style.boxShadow`; "none" in light theme
 *  silences the glow. */
export function getPresenceGlow(status: OnlineStatus): string | undefined {
  switch (status) {
    case "online":
      return "var(--glow-success)";
    case "idle":
      return "var(--glow-warning)";
    case "offline":
      return undefined;
  }
}

export function getPresenceLabel(status: OnlineStatus): string {
  switch (status) {
    case "online":
      return "在线";
    case "idle":
      return "空闲";
    case "offline":
      return "离线";
  }
}
