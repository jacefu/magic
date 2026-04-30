import type { MatrixEvent } from "matrix-js-sdk";
import type { SerializedMatrixEvent } from "@magic/shared-types";

export function serializeEvent(event: MatrixEvent): SerializedMatrixEvent {
  return {
    eventId: event.getId() ?? "",
    roomId: event.getRoomId() ?? "",
    type: event.getType(),
    sender: event.getSender() ?? "",
    content: event.getContent(),
    timestamp: event.getTs(),
    unsigned: event.getUnsigned(),
  };
}

export interface SerializedMember {
  userId: string;
  displayName: string;
  avatarMxc?: string;
}

export function serializeRoomMember(member: {
  userId: string;
  name: string;
  getMxcAvatarUrl: () => string | null;
}): SerializedMember {
  return {
    userId: member.userId,
    displayName: member.name,
    avatarMxc: member.getMxcAvatarUrl() ?? undefined,
  };
}
