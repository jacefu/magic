import { useCallback, useRef, useState } from "react";
import {
  sendTextMessage,
  sendReply,
  getClient,
  hasClient,
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
      // Lift any plain "@displayName" references into the placeholder
      // format `[@displayName](userId)` so parseMentions can pick them
      // up. The composer textarea contains clean text only — the
      // mapping back to userIds happens here, against the live room
      // member list.
      const resolved = resolveMentionsToPlaceholders(text, roomId);
      if (hasMentions(resolved)) {
        const parsed = parseMentions(resolved);
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

/**
 * Convert plain "@<displayName>" references in user-typed text into the
 * placeholder syntax that `parseMentions` consumes:
 *   "@alice hello" → "[@alice](@alice:example.com) hello"
 *
 * The mapping is read from the room's joined-member list at send time.
 * Word-boundary checks: "@" must be at start-of-string or preceded by
 * whitespace, and the matched name must NOT be followed by another
 * alphanumeric/underscore — avoids hitting "email@example.com" or
 * partial-prefix collisions. Longest member name wins when multiple
 * candidates share a prefix.
 */
export function resolveMentionsToPlaceholders(
  text: string,
  roomId: string,
): string {
  if (!hasClient()) return text;
  const room = getClient().getRoom(roomId);
  if (!room) return text;

  const members = room.getJoinedMembers().map((m) => ({
    userId: m.userId,
    displayName:
      m.name || m.userId.match(/^@([^:]+)/)?.[1] || m.userId,
  }));
  if (members.length === 0) return text;

  members.sort((a, b) => b.displayName.length - a.displayName.length);
  const pattern = members.map((m) => escapeRegExp(m.displayName)).join("|");
  const re = new RegExp(`(^|\\s)@(${pattern})(?![A-Za-z0-9_])`, "gu");

  return text.replace(re, (_full, prefix, name) => {
    const member = members.find((m) => m.displayName === name)!;
    return `${prefix}[@${name}](${member.userId})`;
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
