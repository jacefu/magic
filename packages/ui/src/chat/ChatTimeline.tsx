import { useCallback, useEffect, useRef, useState } from "react";
import {
  getClient,
  hasClient,
  paginateBackwards,
  sendReadReceipt,
  useAuthStore,
  useRoomStore,
  useSessionStore,
} from "@magic/matrix-client";
import { useTimeline, type TimelineItem } from "../hooks/useTimeline.js";
import { MessageBubble } from "./MessageBubble.js";
import { DateSeparator } from "./DateSeparator.js";
import { UnreadDivider } from "./UnreadDivider.js";
import { TypingIndicator } from "./TypingIndicator.js";
import { NewMessageButton } from "./NewMessageButton.js";
import { EmptyRoom } from "./EmptyRoom.js";

interface ChatTimelineProps {
  roomId: string;
  onReply?: (eventId: string) => void;
  /**
   * Set by ChatView so that `MessageComposer.onSent` can call
   * `current()` after a successful send and pin the view to the
   * just-shipped message.
   */
  scrollToBottomRef?: React.MutableRefObject<(() => void) | null>;
  /**
   * Active in-room search query. When set, MessageBubble highlights
   * matched substrings inline.
   */
  searchQuery?: string;
  /**
   * Event id of the currently active search match. The timeline scrolls
   * the matching message into view and MessageBubble paints a ring
   * around it.
   */
  highlightEventId?: string | null;
  /**
   * Bumped every time the user presses prev/next. Lets the scroll-to-
   * match effect re-fire even when `highlightEventId` didn't change
   * (single-match case where wrapping next/prev keeps the same id).
   */
  searchJumpCount?: number;
}

// Pagination is triggered when the user scrolls within this many pixels
// of the top. Generous enough that the prefetch happens before the user
// hits the absolute top.
const PAGINATE_THRESHOLD_PX = 120;

// "Near the bottom" window. While the user is within this many pixels
// of the scroll-end, new messages auto-follow; further away, they get
// the "↓ 新消息" button instead.
const AT_BOTTOM_THRESHOLD_PX = 200;

/**
 * Native chat timeline.
 *
 * The earlier react-virtuoso implementation kept clipping the last
 * message because Virtuoso's `initialTopMostItemIndex` re-evaluated on
 * every timeline change and "rebounded" to a stale measurement. Native
 * scroll has no measurement model — `scrollHeight` is the DOM truth —
 * so the bottom anchor always lands where it should.
 *
 * Layout depends on the flex chain (MainLayout chat column,
 * ChatView root, this component) ALL having `min-h-0 overflow-hidden`.
 * Without that the chat box grows tall enough to fit every message
 * and the last one ends up clipped by the composer.
 */
export function ChatTimeline({
  roomId,
  onReply,
  scrollToBottomRef,
  searchQuery,
  highlightEventId,
  searchJumpCount,
}: ChatTimelineProps) {
  const currentUserId = useAuthStore((s) => s.userId);
  const unreadMarker = useUnreadMarker(roomId, currentUserId);
  const { items, messageCount } = useTimeline({
    roomId,
    currentUserId,
    unreadMarkerEventId: unreadMarker,
  });
  const unreadCount = useRoomStore((s) => s.rooms[roomId]?.unreadCount ?? 0);

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Track the user's reading position so new messages don't hijack
  // their scroll while they're browsing history.
  const [isAtBottom, setIsAtBottom] = useState(true);

  // History-pagination state. We can't naively trigger paginate-on-
  // scroll-zero because the act of pagination prepends content and
  // resets scrollTop, which would re-trigger pagination forever. We
  // gate behind an in-flight flag and restore the visual scroll
  // position post-pagination so the user's eye stays put.
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Refs for change-detection across renders.
  const prevRoomIdRef = useRef(roomId);
  const prevItemsLenRef = useRef(0);

  // Set to true while a search-match scroll is in flight. handleScroll
  // bails on its at-bottom recompute and pagination check during this
  // window so the smooth-scroll animation can't latch the user as
  // "browsing history" or trigger an unwanted backfill.
  const isSearchJumpingRef = useRef(false);

  // Tracks the previous active search query so we can detect the
  // "search cleared" transition (had >=2 chars → empty) and snap the
  // view back to the bottom.
  const prevSearchActiveRef = useRef(false);

  // ---- scroll-to-bottom primitive (used everywhere else) ----
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    },
    [],
  );

  // Expose to ChatView so post-send can pin to the just-sent message.
  useEffect(() => {
    if (!scrollToBottomRef) return;
    scrollToBottomRef.current = () => scrollToBottom("smooth");
    return () => {
      scrollToBottomRef.current = null;
    };
  }, [scrollToBottom, scrollToBottomRef]);

  // ---- room switch + initial populate + auto-follow ----
  //
  // One unified effect handles three cases:
  //   1. Room change       → instant scroll to bottom (no animation,
  //                          would otherwise look like a flicker).
  //   2. First populate    → instant scroll. The `prevItemsLenRef`
  //                          starts at 0; first message arrival
  //                          counts as initial.
  //   3. Live grow         → smooth scroll, but only when the user is
  //                          within the at-bottom window. Otherwise
  //                          the "↓ 新消息" button surfaces instead.
  useEffect(() => {
    const prevLen = prevItemsLenRef.current;
    const prevRoom = prevRoomIdRef.current;
    prevRoomIdRef.current = roomId;
    prevItemsLenRef.current = items.length;

    if (items.length === 0) return;

    const roomChanged = prevRoom !== roomId;
    const initialPopulate = !roomChanged && prevLen === 0;
    const grew = !roomChanged && items.length > prevLen;

    if (roomChanged || initialPopulate) {
      // Settle in two rAFs so any tall last-item content (markdown
      // tables, code blocks, mention pills) has measured before we
      // anchor to it. One frame for the React commit, the next for
      // the post-paint measurement settle.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "instant" });
        });
      });
      setIsAtBottom(true);
      return;
    }

    if (grew && isAtBottom) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [items.length, roomId, isAtBottom]);

  // ---- pagination on scroll-near-top ----
  const handleStartReached = useCallback(async () => {
    if (isLoadingHistory) return;
    const container = containerRef.current;
    if (!container) return;
    const prevScrollHeight = container.scrollHeight;
    setIsLoadingHistory(true);
    try {
      await paginateBackwards(roomId, 50);
    } catch (err) {
      console.error("加载历史失败:", err);
    } finally {
      setIsLoadingHistory(false);
    }
    // After history prepends, the new content shifts the visible
    // window upward. Restore scrollTop to the equivalent visual
    // offset so the user's eye doesn't jump.
    requestAnimationFrame(() => {
      const c = containerRef.current;
      if (!c) return;
      c.scrollTop = c.scrollHeight - prevScrollHeight;
    });
  }, [isLoadingHistory, roomId]);

  // ---- scroll handler ----
  const handleScroll = useCallback(() => {
    // Smooth-scrolling to a search match emits dozens of scroll events
    // mid-flight. Treating those as user-driven browsing would (a)
    // strand isAtBottom on `false` so new messages stop auto-following
    // and (b) accidentally trigger backfill if the match sits near the
    // top. Bail until the jump settles.
    if (isSearchJumpingRef.current) return;

    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setIsAtBottom(distanceFromBottom <= AT_BOTTOM_THRESHOLD_PX);

    // Trigger history pagination when the user nears the top, but
    // don't fight an in-flight load.
    if (
      scrollTop <= PAGINATE_THRESHOLD_PX &&
      !isLoadingHistory &&
      messageCount > 0
    ) {
      void handleStartReached();
    }
  }, [handleStartReached, isLoadingHistory, messageCount]);

  // ---- read marker advance ----
  //
  // Once the user is parked at the bottom, advance the server-side
  // read receipt to the latest message and clear the local unread
  // count optimistically (so the room-list badge disappears
  // immediately rather than after the homeserver echoes the receipt).
  const latestMessageEventId = useLatestMessageEventId(roomId);
  useEffect(() => {
    if (!isAtBottom || !latestMessageEventId) return;
    void sendReadReceipt(roomId, latestMessageEventId).catch(() => {
      /* best-effort */
    });
    const sessionId = useSessionStore.getState().activeSessionId;
    if (sessionId) {
      useRoomStore.getState().setUnreadCount(sessionId, roomId, 0, 0);
    }
  }, [isAtBottom, latestMessageEventId, roomId]);

  // Scroll the active search match into view. We rely on the per-bubble
  // `id="msg-<eventId>"` set by MessageBubble — getElementById is fine
  // here because event ids are globally unique within a Matrix homeserver.
  //
  // The dep on searchJumpCount lets prev/next still re-fire when only
  // one match exists (wrapping keeps `highlightEventId` constant).
  // rAF defers to after the React commit so the bubble id is mounted
  // before we look it up.
  useEffect(() => {
    if (!highlightEventId) return;
    isSearchJumpingRef.current = true;
    const raf = requestAnimationFrame(() => {
      const node = document.getElementById(`msg-${highlightEventId}`);
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    // Smooth scroll typically settles in well under 500ms even on long
    // distances. Releasing the ref past that mark lets handleScroll
    // resume tracking the user's read position normally.
    const timer = window.setTimeout(() => {
      isSearchJumpingRef.current = false;
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [highlightEventId, searchJumpCount]);

  // Detect "search cleared" — `query` had >=2 chars on the last render
  // and is now empty. Snap back to bottom + restore at-bottom so live
  // messages auto-follow again. Without this the user is stranded
  // wherever the last match scroll left them.
  useEffect(() => {
    const isActive = !!searchQuery && searchQuery.trim().length >= 2;
    const wasActive = prevSearchActiveRef.current;
    prevSearchActiveRef.current = isActive;
    if (wasActive && !isActive) {
      isSearchJumpingRef.current = false;
      setIsAtBottom(true);
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "instant" });
      });
    }
  }, [searchQuery]);

  if (messageCount === 0 && items.length === 0) {
    return <EmptyRoom />;
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto"
      >
        {/* Top spinner — visible only while a back-pagination is
            in flight. */}
        {isLoadingHistory && (
          <div className="flex justify-center py-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--brand-purple)] border-t-transparent" />
          </div>
        )}

        <div className="pt-2" />

        {items.map((item) => (
          <TimelineItemRow
            key={timelineItemKey(item)}
            item={item}
            onReply={onReply}
            searchQuery={searchQuery}
            highlightEventId={highlightEventId}
          />
        ))}

        {/* Bottom anchor — scrollIntoView target. */}
        <div ref={bottomRef} className="h-px w-full" />
      </div>

      {/* Always surface a jump-to-bottom affordance when the user is
          parked above the at-bottom window — paginating into history
          and then needing to scroll all the way back manually was the
          actual stuck-at-top complaint. The label flips between
          "↓ 新消息" (pending unread) and "↓ 最新消息" (catch-up button)
          so it never claims new content that isn't there. */}
      {!isAtBottom && (
        <NewMessageButton
          onClick={() => scrollToBottom("smooth")}
          label={unreadCount > 0 ? "↓ 新消息" : "↓ 最新消息"}
        />
      )}
    </div>
  );
}

function timelineItemKey(item: TimelineItem): string {
  switch (item.type) {
    case "message":
      return item.event.eventId;
    case "date-separator":
    case "unread-divider":
      return item.key;
    case "typing":
      return "typing";
  }
}

function TimelineItemRow({
  item,
  onReply,
  searchQuery,
  highlightEventId,
}: {
  item: TimelineItem;
  onReply?: (eventId: string) => void;
  searchQuery?: string;
  highlightEventId?: string | null;
}) {
  switch (item.type) {
    case "message":
      return (
        <MessageBubble
          event={item.event}
          showSender={item.showSender}
          isOwn={item.isOwn}
          onReply={onReply}
          searchQuery={searchQuery}
          isHighlighted={item.event.eventId === highlightEventId}
        />
      );
    case "date-separator":
      return <DateSeparator date={item.date} />;
    case "unread-divider":
      return <UnreadDivider date={item.date} />;
    case "typing":
      return <TypingIndicator users={item.users} />;
    default:
      return null;
  }
}

/**
 * Snapshot the user's read-up-to event id once per room session. Stays
 * pinned for the lifetime of this ChatTimeline mount so the unread
 * divider doesn't dance around as new messages arrive — Discord behaviour.
 */
function useUnreadMarker(
  roomId: string,
  currentUserId: string | null,
): string | null {
  const [marker, setMarker] = useState<string | null>(null);
  useEffect(() => {
    if (!currentUserId || !hasClient()) {
      setMarker(null);
      return;
    }
    const room = getClient().getRoom(roomId);
    setMarker(room?.getEventReadUpTo(currentUserId) ?? null);
  }, [roomId, currentUserId]);
  return marker;
}

/** Latest m.room.message / m.room.encrypted eventId in the timeline. */
function useLatestMessageEventId(roomId: string): string | null {
  return useRoomStore((s) => {
    const tl = s.rooms[roomId]?.timeline;
    if (!tl) return null;
    for (let i = tl.length - 1; i >= 0; i--) {
      const e = tl[i];
      if (e.type === "m.room.message" || e.type === "m.room.encrypted") {
        return e.eventId;
      }
    }
    return null;
  });
}
