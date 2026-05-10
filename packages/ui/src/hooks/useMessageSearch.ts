import { useCallback, useEffect, useMemo, useState } from "react";
import type { SerializedMatrixEvent } from "@magic/shared-types";
import { useRoomStore } from "@magic/matrix-client";

export interface SearchMatch {
  eventId: string;
  index: number;
  sender: string;
  body: string;
  timestamp: number;
}

export interface MessageSearch {
  query: string;
  setQuery: (q: string) => void;
  matches: SearchMatch[];
  activeMatchIndex: number;
  activeMatch: SearchMatch | null;
  goToPrevMatch: () => void;
  goToNextMatch: () => void;
  clearSearch: () => void;
  /**
   * Bumped on every prev/next press. Lets ChatTimeline re-fire its
   * scroll-to-match effect even when the active eventId hasn't moved
   * (e.g. only one match exists, so wrapping next/prev keeps the same id).
   */
  jumpCount: number;
}

const MIN_QUERY_LEN = 2;

function extractBody(event: SerializedMatrixEvent): string {
  const content = event.content as Record<string, unknown> | undefined;
  if (!content) return "";
  const direct = content["body"];
  if (typeof direct === "string") return direct;
  const newContent = content["m.new_content"];
  if (newContent && typeof newContent === "object") {
    const newBody = (newContent as Record<string, unknown>)["body"];
    if (typeof newBody === "string") return newBody;
  }
  return "";
}

export function useMessageSearch(roomId: string): MessageSearch {
  const [query, setQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [jumpCount, setJumpCount] = useState(0);

  // `s.rooms` is the active-session mirror — see roomStore relinkActiveRooms.
  const timeline = useRoomStore((s) => s.rooms[roomId]?.timeline);

  // Switching rooms or re-mounting the hook should clear residual state so
  // the previous room's query doesn't leak into the new header.
  useEffect(() => {
    setQuery("");
    setActiveMatchIndex(0);
    setJumpCount(0);
  }, [roomId]);

  const matches: SearchMatch[] = useMemo(() => {
    const term = query.trim();
    if (term.length < MIN_QUERY_LEN || !timeline) return [];
    const lowerTerm = term.toLowerCase();
    const results: SearchMatch[] = [];
    timeline.forEach((event, index) => {
      const body = extractBody(event);
      if (!body) return;
      if (body.toLowerCase().includes(lowerTerm)) {
        results.push({
          eventId: event.eventId,
          index,
          sender: event.sender,
          body,
          timestamp: event.timestamp,
        });
      }
    });
    return results;
  }, [query, timeline]);

  // Snap the active index back into bounds whenever the match list shrinks
  // (e.g. user kept typing past the last hit, or timeline trimmed history).
  useEffect(() => {
    if (matches.length === 0) {
      if (activeMatchIndex !== 0) setActiveMatchIndex(0);
      return;
    }
    if (activeMatchIndex >= matches.length) {
      setActiveMatchIndex(matches.length - 1);
    }
  }, [matches.length, activeMatchIndex]);

  const goToPrevMatch = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatchIndex(
      (prev) => (prev - 1 + matches.length) % matches.length,
    );
    setJumpCount((c) => c + 1);
  }, [matches.length]);

  const goToNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % matches.length);
    setJumpCount((c) => c + 1);
  }, [matches.length]);

  const activeMatch =
    matches.length > 0 && activeMatchIndex < matches.length
      ? matches[activeMatchIndex]
      : null;

  const clearSearch = useCallback(() => {
    setQuery("");
    setActiveMatchIndex(0);
    setJumpCount(0);
  }, []);

  return {
    query,
    setQuery,
    matches,
    activeMatchIndex,
    activeMatch,
    goToPrevMatch,
    goToNextMatch,
    clearSearch,
    jumpCount,
  };
}
