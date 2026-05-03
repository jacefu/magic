import { useCallback, useEffect, useRef, useState } from "react";
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
  /**
   * Fires after a successful send. ChatView wires it to
   * `ChatTimeline.scrollToBottomRef` so the view follows the
   * message you just shipped (Spec 019 FIX-3).
   */
  onSent?: () => void;
}

const drafts = new Map<string, string>();

export function useComposer({ roomId, onSent }: UseComposerOptions) {
  const [value, setValue] = useState(() => drafts.get(roomId) ?? "");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const replyToEventId = useUIStore((s) => s.composerReplyTo);
  const setReplyTo = useUIStore((s) => s.setComposerReplyTo);
  const insertRequest = useUIStore((s) => s.composerInsertRequest);
  const consumeInsert = useUIStore((s) => s.consumeComposerInsert);
  const activeRoom = useRoomStore((s) => s.rooms[roomId]);
  const activeRoomId = useRoomStore((s) => s.activeRoomId);

  const { notifyTyping, stopTyping } = useTypingNotifier(roomId);

  // Inject text from external sources (sender-name click, emoji picker, …)
  // at the current cursor position. Auto-pads with a leading space so
  // "@manager" and "@alice" can stack without colliding into "@manager@alice".
  useEffect(() => {
    if (!insertRequest) return;
    // Only apply if this composer is for the currently-active room — we
    // don't want a click-to-mention from a stale tab to splatter the
    // foreground composer.
    if (activeRoomId !== roomId) return;

    const textarea = inputRef.current;
    const cursorPos =
      textarea?.selectionStart ?? value.length;
    const before = value.slice(0, cursorPos);
    const after = value.slice(cursorPos);
    const needsLeadingSpace =
      before.length > 0 && !/\s$/.test(before);
    const needsTrailingSpace = after.length > 0 && !/^\s/.test(after);
    const insertion =
      (needsLeadingSpace ? " " : "") +
      insertRequest.text +
      (needsTrailingSpace ? "" : "");

    const next = before + insertion + after;
    setValue(next);
    drafts.set(roomId, next);

    // Defer the cursor move + focus to the next frame so React has
    // committed the new value to the textarea.
    const targetCursor = (before + insertion).length;
    requestAnimationFrame(() => {
      const ta = inputRef.current;
      if (!ta) return;
      ta.focus();
      ta.selectionStart = targetCursor;
      ta.selectionEnd = targetCursor;
    });

    consumeInsert();
  }, [insertRequest, activeRoomId, roomId, value, consumeInsert]);

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
      // Defer the scroll-to-bottom callback so the just-sent event has
      // a chance to round-trip through the bridge → roomStore →
      // useTimeline → Virtuoso pipeline. ~50ms covers the local-echo
      // path; if the homeserver is slow, the existing grow-driven
      // useEffect in ChatTimeline catches the late append on its own.
      if (onSent) {
        setTimeout(onSent, 50);
      }
    } catch (err) {
      console.error("发送消息失败:", err);
    } finally {
      setIsSending(false);
    }
  }, [
    value,
    isSending,
    roomId,
    replyToEventId,
    setReplyTo,
    stopTyping,
    onSent,
  ]);

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
