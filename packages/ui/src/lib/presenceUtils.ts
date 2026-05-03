import {
  getClient,
  hasClient,
  useAgentStore,
} from "@magic/matrix-client";
import { getAgentInfo } from "./agentDetection.js";

export type OnlineStatus = "online" | "idle" | "offline";

/**
 * If we haven't received a heartbeat from an Agent in this many ms, we
 * treat it as offline regardless of the last `agent.status` event.
 * HiClaw workers heartbeat every ~30s; 90s gives 2-3 missed cycles
 * before we flip the dot.
 */
const HEARTBEAT_STALE_MS = 90_000;

/**
 * Read a *human* user's online status from matrix-js-sdk Presence.
 * Reliable for real Matrix users with a live SDK client. NOT reliable
 * for HiClaw worker accounts — Synapse caches presence for ~5 min
 * after the container's sync loop dies, so a stopped worker keeps
 * advertising "online" until the homeserver times it out. For agents,
 * use {@link getEffectivePresence} or {@link getAgentPresence} instead.
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

/**
 * Truth source for whether a HiClaw Agent is actually running right
 * now. Reads the latest `com.magic.agent.status` event from the
 * agentStore and gates it on heartbeat freshness — so a worker whose
 * container was killed shows offline within 90s even if the homeserver
 * still has stale Matrix Presence cached for it.
 *
 * Returns "offline" when no agent record exists yet (registry-only
 * agents that haven't emitted a status event count as offline because
 * we have no positive signal they're up).
 */
export function getAgentPresence(userId: string): OnlineStatus {
  const agent = Object.values(useAgentStore.getState().agents).find(
    (a) => a.userId === userId,
  );
  if (!agent) return "offline";

  if (Date.now() - agent.lastHeartbeat > HEARTBEAT_STALE_MS) {
    return "offline";
  }

  switch (agent.status) {
    case "active":
      return "online";
    case "idle":
      return "idle";
    case "error":
    case "offline":
    default:
      return "offline";
  }
}

/**
 * Pick the right presence source per user type:
 *   - Agents (per `getAgentInfo`) → {@link getAgentPresence} so the
 *     dot reflects actual container heartbeats, not stale Matrix
 *     Presence.
 *   - Humans → {@link getUserPresence} (Matrix Presence).
 *
 * Use this anywhere you render a status dot for a userId you don't
 * already know is human (room list DMs, member panel, mention items).
 */
export function getEffectivePresence(userId: string): OnlineStatus {
  if (getAgentInfo(userId).isAgent) {
    return getAgentPresence(userId);
  }
  return getUserPresence(userId);
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
