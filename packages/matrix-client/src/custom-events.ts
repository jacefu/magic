import { getClient } from "./client.js";
import {
  MAGIC_EVENTS,
  AgentStatusEvent,
  TaskAssignmentEvent,
  SoulContentEvent,
} from "@magic/shared-types";
import type { MatrixClient } from "matrix-js-sdk";

// Cast to any for custom event types not in the SDK's typed event maps
type AnyClient = Pick<MatrixClient, "getRoom"> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendEvent(roomId: string, eventType: string, content: any): Promise<{ event_id?: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendStateEvent(roomId: string, eventType: string, content: any, stateKey?: string): Promise<{ event_id?: string }>;
};

function anyClient(): AnyClient {
  return getClient() as unknown as AnyClient;
}

export async function sendAgentStatus(roomId: string, data: AgentStatusEvent): Promise<string> {
  AgentStatusEvent.parse(data);
  const client = anyClient();
  const { event_id } = await client.sendEvent(roomId, MAGIC_EVENTS.AGENT_STATUS, data);
  return event_id ?? "";
}

export async function sendTaskAssignment(roomId: string, data: TaskAssignmentEvent): Promise<string> {
  TaskAssignmentEvent.parse(data);
  const client = anyClient();
  const { event_id } = await client.sendStateEvent(
    roomId,
    MAGIC_EVENTS.TASK_ASSIGNMENT,
    data,
    data.task_id,
  );
  return event_id ?? "";
}

export async function sendSoulContent(roomId: string, data: SoulContentEvent): Promise<string> {
  SoulContentEvent.parse(data);
  const client = anyClient();
  const eventType = data.file_type === "soul" ? MAGIC_EVENTS.SOUL_CONTENT : MAGIC_EVENTS.MEMORY_CONTENT;
  const { event_id } = await client.sendStateEvent(roomId, eventType, data, "");
  return event_id ?? "";
}

export function getAgentStatuses(roomId: string): AgentStatusEvent[] {
  const client = getClient();
  const room = client.getRoom(roomId);
  if (!room) return [];
  const events = room.currentState.getStateEvents(MAGIC_EVENTS.AGENT_STATUS);
  return events
    .map((e) => {
      const result = AgentStatusEvent.safeParse(e.getContent());
      return result.success ? result.data : null;
    })
    .filter((e): e is AgentStatusEvent => e !== null);
}

export function getTaskAssignments(roomId: string): TaskAssignmentEvent[] {
  const client = getClient();
  const room = client.getRoom(roomId);
  if (!room) return [];
  const events = room.currentState.getStateEvents(MAGIC_EVENTS.TASK_ASSIGNMENT);
  return events
    .map((e) => {
      const result = TaskAssignmentEvent.safeParse(e.getContent());
      return result.success ? result.data : null;
    })
    .filter((e): e is TaskAssignmentEvent => e !== null);
}

export function getSoulContent(roomId: string, fileType: "soul" | "memory"): SoulContentEvent | null {
  const client = getClient();
  const room = client.getRoom(roomId);
  if (!room) return null;
  const eventType = fileType === "soul" ? MAGIC_EVENTS.SOUL_CONTENT : MAGIC_EVENTS.MEMORY_CONTENT;
  const event = room.currentState.getStateEvents(eventType, "");
  if (!event) return null;
  const result = SoulContentEvent.safeParse(event.getContent());
  return result.success ? result.data : null;
}
