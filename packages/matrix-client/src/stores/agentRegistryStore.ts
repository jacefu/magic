import { create } from "zustand";

export interface RegisteredAgent {
  /** Worker / Manager Matrix userId, e.g. @worker-alice:magic.com */
  userId: string;
  /** CRD metadata.name, e.g. "alice" */
  name: string;
  /** Runtime kind */
  runtime: "openclaw" | "hermes" | "qwenpaw";
  /** Model identifier, e.g. "qwen3.5-plus" */
  model?: string;
  /** Role */
  role: "worker" | "manager";
}

interface AgentRegistryState {
  agents: Record<string, RegisteredAgent>;
  loaded: boolean;
  error: string | null;

  setAgents: (agents: RegisteredAgent[]) => void;
  setError: (error: string | null) => void;
  isAgent: (userId: string) => boolean;
  getAgent: (userId: string) => RegisteredAgent | null;
  reset: () => void;
}

export const useAgentRegistryStore = create<AgentRegistryState>((set, get) => ({
  agents: {},
  loaded: false,
  error: null,

  setAgents: (agents) => {
    const map: Record<string, RegisteredAgent> = {};
    for (const a of agents) map[a.userId] = a;
    set({ agents: map, loaded: true, error: null });
  },

  setError: (error) => set({ error, loaded: true }),

  isAgent: (userId) => userId in get().agents,
  getAgent: (userId) => get().agents[userId] ?? null,

  reset: () => set({ agents: {}, loaded: false, error: null }),
}));
