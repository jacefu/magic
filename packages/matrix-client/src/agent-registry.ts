import {
  useAgentRegistryStore,
  type RegisteredAgent,
} from "./stores/agentRegistryStore.js";
import { useAuthStore } from "./stores/authStore.js";

/**
 * Fetch the full Worker / Manager roster from the HiClaw Controller's CRD
 * API and populate `agentRegistryStore`. Called once after the initial
 * Matrix sync completes.
 *
 * Endpoints:
 *   GET {controllerUrl}/api/v1/workers   → Worker list
 *   GET {controllerUrl}/api/v1/managers  → Manager list
 *
 * Failure mode: any network / parse error sets `error` on the store and
 * marks `loaded: true`, which lets `agentDetection`'s third-tier
 * username-pattern fallback take over without ever throwing.
 */
export async function fetchAgentRegistry(controllerUrl: string): Promise<void> {
  const store = useAgentRegistryStore.getState();
  const collected: RegisteredAgent[] = [];

  try {
    // Workers
    const workersRes = await fetch(`${controllerUrl}/api/v1/workers`);
    if (workersRes.ok) {
      const data = await workersRes.json();
      const items = Array.isArray(data) ? data : (data.items ?? []);
      for (const w of items) {
        const name = w.metadata?.name ?? w.name ?? "";
        const spec = w.spec ?? {};
        collected.push({
          userId: w.status?.matrixUserId ?? `@worker-${name}:${getHomeserverDomain()}`,
          name,
          runtime: normalizeRuntime(spec.runtime),
          model: spec.model,
          role: "worker",
        });
      }
    }

    // Managers
    const managerRes = await fetch(`${controllerUrl}/api/v1/managers`);
    if (managerRes.ok) {
      const data = await managerRes.json();
      const items = Array.isArray(data) ? data : (data.items ?? [data]);
      for (const m of items) {
        const name = m.metadata?.name ?? "manager";
        collected.push({
          userId: m.status?.matrixUserId ?? `@${name}:${getHomeserverDomain()}`,
          name,
          runtime: normalizeRuntime(m.spec?.runtime ?? "openclaw"),
          model: m.spec?.model,
          role: "manager",
        });
      }
    }

    store.setAgents(collected);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("HiClaw CRD API unavailable, falling back to event-based detection:", msg);
    store.setError(msg);
  }
}

function normalizeRuntime(raw: string | undefined): RegisteredAgent["runtime"] {
  const r = (raw ?? "").toLowerCase();
  if (r.includes("hermes")) return "hermes";
  if (r.includes("copaw") || r.includes("qwenpaw")) return "qwenpaw";
  return "openclaw";
}

function getHomeserverDomain(): string {
  const homeserver = useAuthStore.getState().homeserver;
  if (homeserver) {
    try {
      return new URL(homeserver).hostname;
    } catch {
      // fall through
    }
  }
  return "matrix.magic.com";
}
