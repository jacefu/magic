import { Preset } from "matrix-js-sdk";
import type { Room } from "matrix-js-sdk";
import { getClient } from "./client.js";

export async function createRoom(options: CreateRoomOptions): Promise<string> {
  const client = getClient();
  const { room_id } = await client.createRoom({
    name: options.name,
    topic: options.topic,
    preset: options.encrypted ? Preset.PrivateChat : Preset.PublicChat,
    invite: options.invite,
    initial_state: options.encrypted
      ? [{ type: "m.room.encryption", state_key: "", content: { algorithm: "m.megolm.v1.aes-sha2" } }]
      : undefined,
  });
  return room_id;
}

export async function joinRoom(roomIdOrAlias: string): Promise<string> {
  const client = getClient();
  const room = await client.joinRoom(roomIdOrAlias);
  return room.roomId;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const client = getClient();
  await client.leave(roomId);
}

export async function inviteUser(roomId: string, userId: string): Promise<void> {
  const client = getClient();
  await client.invite(roomId, userId);
}

export function getRooms(): Room[] {
  const client = getClient();
  return client.getRooms();
}

export function getRoom(roomId: string): Room | null {
  const client = getClient();
  return client.getRoom(roomId);
}

export interface CreateRoomOptions {
  name: string;
  topic?: string;
  invite?: string[];
  encrypted?: boolean;
}
