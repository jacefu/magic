import { useCallback, useRef, useState } from "react";
import {
  sendTextMessage,
  sendReply,
  getClient,
  useRoomStore,
  useUIStore,
} from "@magic/matrix-client";
import { useTypingNotifier } from "./useTypingNotifier.js";
import { hasMentions, parseMentions } from "../lib/mentionParser.js";

interface UseComposerOptions {
  roomId: string;
}

const drafts = new Map<string, string>();

export function useComposer({ roomId }: UseComposerOptions) {
  const [value, setValue] = useState(() => drafts.get(roomId) ?? "");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const replyToEventId = useUIStore((s) => s.composerReplyTo);
  const setReplyTo = useUIStore((s) => s.setComposerReplyTo);
  const activeRoom = useRoomStore((s) => s.rooms[roomId]);

  const { notifyTyping, stopTyping } = useTypingNotifier(roomId);

  const handleChange = useCallback(
    (text: string) => {
      setValue(text);
      drafts.set(roomId, text);
      if (text.trim()) {
        notifyTyping();
      } else {
        stopTyping();
      }
    },
    [roomId, notifyTyping, stopTyping],
  );

  const handleSend = useCallback(async () => {
    const text = value.trim();
    if (!text || isSending) return;

    setIsSending(true);
    stopTyping();

    try {
      if (hasMentions(text)) {
        const parsed = parseMentions(text);
        const content: Record<string, unknown> = {
          msgtype: "m.text",
          body: parsed.body,
          format: "org.matrix.custom.html",
          formatted_body: parsed.formattedBody,
          "m.mentions": parsed.mentions,
        };
        if (replyToEventId) {
          content["m.relates_to"] = {
            "m.in_reply_to": { event_id: replyToEventId },
          };
        }
        const client = getClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await client.sendMessage(roomId, content as any);
        if (replyToEventId) setReplyTo(null);
      } else if (replyToEventId) {
        await sendReply(roomId, text, replyToEventId);
        setReplyTo(null);
      } else {
        await sendTextMessage(roomId, text);
      }
      setValue("");
      drafts.delete(roomId);
      inputRef.current?.focus();
    } catch (err) {
      console.error("发送消息失败:", err);
    } finally {
      setIsSending(false);
    }
  }, [value, isSending, roomId, replyToEventId, setReplyTo, stopTyping]);

  const cancelReply = useCallback(() => {
    setReplyTo(null);
  }, [setReplyTo]);

  const startReply = useCallback(
    (eventId: string) => {
      setReplyTo(eventId);
      inputRef.current?.focus();
    },
    [setReplyTo],
  );

  const replyEvent = replyToEventId
    ? activeRoom?.timeline.find((e) => e.eventId === replyToEventId) ?? null
    : null;

  const switchRoom = useCallback((newRoomId: string) => {
    setValue(drafts.get(newRoomId) ?? "");
  }, []);

  return {
    value,
    setValue: handleChange,
    isSending,
    inputRef,
    replyEvent,
    replyToEventId,
    handleSend,
    cancelReply,
    startReply,
    switchRoom,
  };
}

// Exposed for tests
export const __DRAFTS_INTERNAL__ = drafts;
