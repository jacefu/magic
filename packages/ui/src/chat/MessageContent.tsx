import type { SerializedMatrixEvent } from "@magic/shared-types";
import { TextMessage } from "./TextMessage.js";
import { ImageMessage } from "./ImageMessage.js";
import { FileMessage } from "./FileMessage.js";
import { UndecryptedMessage } from "../crypto/UndecryptedMessage.js";

interface MessageContentProps {
  event: SerializedMatrixEvent;
  isOwn: boolean;
}

export function MessageContent({ event, isOwn }: MessageContentProps) {
  if (event.type === "m.room.encrypted") {
    return <UndecryptedMessage />;
  }

  const content = event.content;
  const msgtype = content.msgtype as string;

  switch (msgtype) {
    case "m.text":
    case "m.notice":
      return (
        <TextMessage
          body={content.body as string}
          formattedBody={content.formatted_body as string | undefined}
          format={content.format as string | undefined}
          isOwn={isOwn}
          roomId={event.roomId}
        />
      );
    case "m.image":
      return (
        <ImageMessage
          body={content.body as string}
          url={content.url as string}
          info={content.info as Record<string, unknown> | undefined}
        />
      );
    case "m.file":
    case "m.audio":
    case "m.video":
      return (
        <FileMessage
          body={content.body as string}
          url={content.url as string}
          msgtype={msgtype}
          info={content.info as Record<string, unknown> | undefined}
        />
      );
    case "m.emote":
      return (
        <span className="italic text-text-normal">
          * {extractDisplayName(event.sender)} {content.body as string}
        </span>
      );
    default:
      return (
        <span className="text-text-muted">[不支持的消息类型: {msgtype}]</span>
      );
  }
}

function extractDisplayName(userId: string): string {
  const match = userId.match(/^@([^:]+)/);
  return match ? match[1] : userId;
}
