import {
  useAgentRegistryStore,
  useAgentStore,
  usePresenceStore,
} from "@magic/matrix-client";

export type AgentRuntime = "openclaw" | "hermes" | "qwenpaw" | null;
export type AgentRole = "worker" | "manager" | null;

export interface AgentInfo {
  isAgent: boolean;
  runtime: AgentRuntime;
  role: AgentRole;
  /** null when status is unknown (e.g. registry hit but no live agent.status event yet) */
  status: "online" | "idle" | "offline" | "error" | null;
  source: "crd-api" | "agent-event" | "name-pattern" | "none";
  tagLabel: string | null;
  /** rgba string for the runtime tag pill background */
  tagBg: string | null;
  /** hex string for the runtime tag pill text */
  tagColor: string | null;
  /** hex string for the sender / member name color */
  nameColor: string;
}

/**
 * Three-layer Agent identification:
 *   1. CRD API registry — authoritative; populated post-sync via fetchAgentRegistry.
 *   2. agentStore — live `com.magic.agent.status` events (Agent must be running).
 *   3. Username pattern — last-resort fallback used only when the registry
 *      explicitly failed (loaded && error). When the registry is still
 *      loading we deliberately skip the pattern fallback so we don't
 *      flicker tag visibility on first paint.
 */
export function getAgentInfo(userId: string, roomId?: string): AgentInfo {
  // Layer 1 — CRD registry
  const registry = useAgentRegistryStore.getState();
  const registered = registry.getAgent(userId);
  if (registered) {
    return {
      isAgent: true,
      runtime: registered.runtime,
      role: registered.role,
      status: getAgentOnlineStatus(userId, roomId),
      source: "crd-api",
      ...getTagStyle(registered.runtime, registered.role),
      nameColor: getNameColor(registered.runtime, registered.role),
    };
  }

  // Layer 2 — live agentStore events
  const agentStore = useAgentStore.getState();
  const agentData = Object.values(agentStore.agents).find(
    (a) => a.userId === userId && (!roomId || a.roomId === roomId),
  );
  if (agentData) {
    const runtime = inferRuntimeFromModel(agentData.model);
    return {
      isAgent: true,
      runtime,
      role: "worker",
      status: applyHeartbeatTimeout(agentData.status, agentData.lastHeartbeat),
      source: "agent-event",
      ...getTagStyle(runtime, "worker"),
      nameColor: getNameColor(runtime, "worker"),
    };
  }

  // Layer 3 — username pattern (only when registry has explicitly failed)
  if (registry.loaded && registry.error) {
    const inferred = inferFromUserId(userId);
    if (inferred) {
      return {
        ...inferred,
        status: null,
        source: "name-pattern",
      };
    }
  }

  return {
    isAgent: false,
    runtime: null,
    role: null,
    status: null,
    source: "none",
    tagLabel: null,
    tagBg: null,
    tagColor: null,
    nameColor: "#DBDEE1",
  };
}

/**
 * Map a real human's Matrix presence into the same status enum we use for
 * Agents. Returns "offline" when no presence data is available (Tuwunel
 * may have presence disabled).
 */
export function getHumanOnlineStatus(
  userId: string,
): "online" | "idle" | "offline" {
  const presence = usePresenceStore.getState().getPresence(userId);
  if (!presence) return "offline";

  const INACTIVE_TIMEOUT = 5 * 60 * 1000;

  switch (presence.presence) {
    case "online":
      if (presence.currentlyActive) return "online";
      if (
        presence.lastActiveAgo !== undefined &&
        presence.lastActiveAgo > INACTIVE_TIMEOUT
      )
        return "idle";
      return "online";
    case "unavailable":
      return "idle";
    case "offline":
    default:
      return "offline";
  }
}

/**
 * One-stop status color resolver — picks the Agent vs human path internally
 * and returns the hex string for a status dot.
 */
export function getStatusColor(userId: string, roomId?: string): string {
  const info = getAgentInfo(userId, roomId);
  if (info.isAgent) {
    switch (info.status) {
      case "online":
        return "#23A55A";
      case "idle":
        return "#F0B232";
      case "error":
        return "#F23F43";
      case "offline":
      default:
        return "#6D6F78";
    }
  }
  switch (getHumanOnlineStatus(userId)) {
    case "online":
      return "#23A55A";
    case "idle":
      return "#F0B232";
    case "offline":
    default:
      return "#6D6F78";
  }
}

// ---- internals ----

function getAgentOnlineStatus(
  userId: string,
  roomId?: string,
): AgentInfo["status"] {
  const agentData = Object.values(useAgentStore.getState().agents).find(
    (a) => a.userId === userId && (!roomId || a.roomId === roomId),
  );
  if (!agentData) return "offline";
  return applyHeartbeatTimeout(agentData.status, agentData.lastHeartbeat);
}

const HEARTBEAT_TIMEOUT_MS = 60_000;

function applyHeartbeatTimeout(
  status: "active" | "idle" | "offline" | "error",
  lastHeartbeat: number,
): AgentInfo["status"] {
  if (
    (status === "active" || status === "idle") &&
    Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT_MS
  ) {
    return "offline";
  }
  switch (status) {
    case "active":
      return "online";
    case "idle":
      return "idle";
    case "offline":
      return "offline";
    case "error":
      return "error";
  }
}

function getTagStyle(
  runtime: AgentRuntime,
  role: AgentRole,
): {
  tagLabel: string | null;
  tagBg: string | null;
  tagColor: string | null;
} {
  if (role === "manager") {
    return {
      tagLabel: "MANAGER",
      tagBg: "rgba(26,188,156,0.25)",
      tagColor: "#1ABC9C",
    };
  }
  switch (runtime) {
    case "hermes":
      return {
        tagLabel: "HERMES",
        tagBg: "rgba(237,66,69,0.25)",
        tagColor: "#F47B67",
      };
    case "qwenpaw":
      return {
        tagLabel: "QWENPAW",
        tagBg: "rgba(35,165,90,0.25)",
        tagColor: "#57F287",
      };
    case "openclaw":
    default:
      return {
        tagLabel: "AGENT",
        tagBg: "rgba(88,101,242,0.25)",
        tagColor: "#A5B0FC",
      };
  }
}

function getNameColor(runtime: AgentRuntime, role: AgentRole): string {
  if (role === "manager") return "#1ABC9C";
  switch (runtime) {
    case "hermes":
      return "#F47B67";
    case "qwenpaw":
      return "#F0B232";
    case "openclaw":
    default:
      return "#57F287";
  }
}

function inferRuntimeFromModel(model: string | undefined): AgentRuntime {
  const m = (model ?? "").toLowerCase();
  if (m.includes("hermes")) return "hermes";
  if (m.includes("qwenpaw") || m.includes("copaw")) return "qwenpaw";
  return "openclaw";
}

function inferFromUserId(
  userId: string,
):
  | (Pick<AgentInfo, "runtime" | "role" | "tagLabel" | "tagBg" | "tagColor" | "nameColor"> & {
      isAgent: true;
    })
  | null {
  const lower = userId.toLowerCase();
  let runtime: AgentRuntime = null;
  let role: AgentRole = null;

  if (lower.includes("hermes")) {
    runtime = "hermes";
    role = "worker";
  } else if (lower.includes("qwenpaw") || lower.includes("copaw")) {
    runtime = "qwenpaw";
    role = "worker";
  } else if (lower.includes("manager")) {
    runtime = "openclaw";
    role = "manager";
  } else if (lower.includes("worker") || lower.includes("agent")) {
    runtime = "openclaw";
    role = "worker";
  } else {
    return null;
  }

  return {
    isAgent: true,
    runtime,
    role,
    ...getTagStyle(runtime, role),
    nameColor: getNameColor(runtime, role),
  };
}
