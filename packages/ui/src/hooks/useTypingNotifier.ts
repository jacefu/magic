import { useCallback, useRef, useEffect } from "react";
import { sendTyping } from "@magic/matrix-client";

const THROTTLE_MS = 10_000;
const TIMEOUT_MS = 5_000;

export function useTypingNotifier(roomId: string) {
  const lastSentRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (isTypingRef.current) {
        sendTyping(roomId, false).catch(() => {});
      }
    };
  }, [roomId]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();

    if (now - lastSentRef.current >= THROTTLE_MS) {
      sendTyping(roomId, true).catch(() => {});
      lastSentRef.current = now;
      isTypingRef.current = true;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      sendTyping(roomId, false).catch(() => {});
      isTypingRef.current = false;
    }, TIMEOUT_MS);
  }, [roomId]);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (isTypingRef.current) {
      sendTyping(roomId, false).catch(() => {});
      isTypingRef.current = false;
    }
  }, [roomId]);

  return { notifyTyping, stopTyping };
}
