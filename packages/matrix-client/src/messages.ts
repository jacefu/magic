import { getClient } from "./client.js";

export async function sendTextMessage(
  roomId: string,
  body: string,
  html?: string,
): Promise<string> {
  const client = getClient();
  const content: Record<string, string> = { msgtype: "m.text", body };
  if (html) {
    content.format = "org.matrix.custom.html";
    content.formatted_body = html;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { event_id } = await client.sendMessage(roomId, content as any);
  return event_id ?? "";
}

export async function sendReply(
  roomId: string,
  body: string,
  replyToEventId: string,
  html?: string,
): Promise<string> {
  const client = getClient();
  const content: Record<string, unknown> = {
    msgtype: "m.text",
    body,
    "m.relates_to": { "m.in_reply_to": { event_id: replyToEventId } },
  };
  if (html) {
    content.format = "org.matrix.custom.html";
    content.formatted_body = html;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { event_id } = await client.sendMessage(roomId, content as any);
  return event_id ?? "";
}

export async function sendReadReceipt(roomId: string, eventId: string): Promise<void> {
  const client = getClient();
  const room = client.getRoom(roomId);
  const event = room?.findEventById(eventId);
  if (event) {
    await client.sendReadReceipt(event);
  }
}

export async function sendTyping(roomId: string, isTyping: boolean): Promise<void> {
  const client = getClient();
  await client.sendTyping(roomId, isTyping, isTyping ? 30000 : 0);
}

export async function paginateBackwards(roomId: string, limit = 30): Promise<boolean> {
  const client = getClient();
  const room = client.getRoom(roomId);
  if (!room) return false;
  const timeline = room.getLiveTimeline();
  return client.paginateEventTimeline(timeline, { backwards: true, limit });
}
