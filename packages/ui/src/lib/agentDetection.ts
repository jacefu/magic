import { useAgentRegistryStore, useAgentStore } from "@magic/matrix-client";

export type AgentRuntime = "openclaw" | "hermes" | "qwenpaw" | null;
export type AgentRole = "worker" | "manager" | null;

export interface AgentInfo {
  isAgent: boolean;
  runtime: AgentRuntime;
  role: AgentRole;
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
 * Identify whether a userId is an Agent and what runtime / role it has.
 * Three layers, in priority order:
 *   1. CRD registry — populated post-sync by `fetchAgentRegistry`. 100% accurate.
 *   2. agentStore — userIds we've seen `com.magic.agent.status` events from.
 *   3. Username pattern — last-resort fallback used only when the registry
 *      is unavailable (failed to load or hasn't loaded yet with an error).
 *
 * Online status is NOT this function's concern — see `presenceUtils.ts`
 * for that. Matrix Presence is the single source of truth for who's online.
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
      source: "crd-api",
      ...getTagStyle(registered.runtime, registered.role),
      nameColor: getNameColor(registered.runtime, registered.role),
    };
  }

  // Layer 2 — live agentStore events
  const agentData = Object.values(useAgentStore.getState().agents).find(
    (a) => a.userId === userId && (!roomId || a.roomId === roomId),
  );
  if (agentData) {
    const runtime = inferRuntimeFromModel(agentData.model);
    return {
      isAgent: true,
      runtime,
      role: "worker",
      source: "agent-event",
      ...getTagStyle(runtime, "worker"),
      nameColor: getNameColor(runtime, "worker"),
    };
  }

  // Layer 3 — username pattern (only when CRD registry is unavailable)
  if (!registry.loaded || registry.error) {
    const inferred = inferFromUserId(userId);
    if (inferred) {
      return { isAgent: true, source: "name-pattern", ...inferred };
    }
  }

  return {
    isAgent: false,
    runtime: null,
    role: null,
    source: "none",
    tagLabel: null,
    tagBg: null,
    tagColor: null,
    nameColor: "#DBDEE1",
  };
}

// ---- internals ----

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
): Omit<AgentInfo, "isAgent" | "source"> | null {
  const n = userId.toLowerCase();
  if (n.includes("hermes")) {
    return {
      runtime: "hermes",
      role: "worker",
      ...getTagStyle("hermes", "worker"),
      nameColor: "#F47B67",
    };
  }
  if (n.includes("qwenpaw") || n.includes("copaw")) {
    return {
      runtime: "qwenpaw",
      role: "worker",
      ...getTagStyle("qwenpaw", "worker"),
      nameColor: "#F0B232",
    };
  }
  if (n.includes("manager")) {
    return {
      runtime: "openclaw",
      role: "manager",
      ...getTagStyle("openclaw", "manager"),
      nameColor: "#1ABC9C",
    };
  }
  if (n.includes("worker") || n.includes("agent")) {
    return {
      runtime: "openclaw",
      role: "worker",
      ...getTagStyle("openclaw", "worker"),
      nameColor: "#57F287",
    };
  }
  return null;
}
