import { useCallback, useEffect, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
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
   * Spec 019 FIX-3 — parents (e.g. ChatView) hold a ref and call
   * `current()` after a message is sent so the view jumps to the
   * latest message regardless of where the timeline-driven
   * `useEffect` happened to land. Belt-and-suspenders next to the
   * automatic scroll-on-grow logic below.
   */
  scrollToBottomRef?: React.MutableRefObject<(() => void) | null>;
}

export function ChatTimeline({
  roomId,
  onReply,
  scrollToBottomRef,
}: ChatTimelineProps) {
  const currentUserId = useAuthStore((s) => s.userId);
  const unreadMarker = useUnreadMarker(roomId, currentUserId);
  const { items, messageCount } = useTimeline({
    roomId,
    currentUserId,
    unreadMarkerEventId: unreadMarker,
  });
  const unreadCount = useRoomStore((s) => s.rooms[roomId]?.unreadCount ?? 0);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Advance the server-side read marker once the user is parked at the
  // bottom of the timeline. The local snapshot above stays put for this
  // session — only the next room visit will re-snapshot at this point.
  // We *also* optimistically clear the local unread/highlight counts so
  // the room-list badge disappears immediately rather than waiting for
  // the server to echo the receipt back via RoomEvent.UnreadNotifications
  // (which can lag by seconds, especially for our own actions).
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

  const handleStartReached = useCallback(async () => {
    if (isLoadingHistory) return;
    setIsLoadingHistory(true);
    try {
      await paginateBackwards(roomId, 50);
    } catch (err) {
      console.error("加载历史失败:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [roomId, isLoadingHistory]);

  // ---- explicit scroll-to-end management ----
  //
  // We deliberately don't rely on Virtuoso's `followOutput` smooth-scroll:
  // it races with item-height measurement when a freshly-appended message
  // contains tall content (mention pill avatars, multi-paragraph body),
  // animates to the *old* bottom, and ends up looking like the view
  // scrolled *upward* after sending. Manual `scrollToIndex` with
  // `index: 'LAST'`, `align: 'end'`, `behavior: 'auto'` lands precisely
  // at the bottom every time and runs after rAF so the new item's
  // height is already measured.
  const isAtBottomRef = useRef(true);
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const prevRoomIdRef = useRef<string | null>(null);
  const prevItemsLengthRef = useRef(-1); // -1 = "haven't seen items yet"

  // Detect room change during render so the next effect run treats the
  // first item-tick of the new room as an initial-populate, not an
  // append.
  if (prevRoomIdRef.current !== roomId) {
    prevRoomIdRef.current = roomId;
    prevItemsLengthRef.current = -1;
  }

  useEffect(() => {
    const prev = prevItemsLengthRef.current;
    prevItemsLengthRef.current = items.length;

    if (items.length === 0) return;

    const isInitialPopulate = prev === -1;
    const grew = !isInitialPopulate && items.length > prev;

    if (!isInitialPopulate && !grew) return;

    // For mid-session appends (not the initial populate), only scroll
    // when (a) the user was already at the bottom, OR (b) the new last
    // message is from the current user. This keeps "scroll up to read
    // history" intact for incoming messages but always pins your own
    // sends to the bottom.
    if (grew && !isAtBottomRef.current) {
      let lastIsOwn = false;
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        if (item.type === "message") {
          lastIsOwn = item.isOwn;
          break;
        }
      }
      if (!lastIsOwn) return;
    }

    requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({
        index: "LAST",
        align: "end",
        behavior: "auto",
      });
    });
  }, [items.length]);

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: "LAST",
      align: "end",
      behavior: "smooth",
    });
  }, []);

  // Expose scrollToBottom to parents that wire it to send completion.
  // The grow-driven useEffect above handles most cases automatically,
  // but Virtuoso races with rapid data updates can occasionally swallow
  // the auto-scroll; the explicit post-send call guarantees the view
  // lands on the freshly-sent message.
  useEffect(() => {
    if (!scrollToBottomRef) return;
    scrollToBottomRef.current = scrollToBottom;
    return () => {
      scrollToBottomRef.current = null;
    };
  }, [scrollToBottom, scrollToBottomRef]);

  if (messageCount === 0 && items.length === 0) {
    return <EmptyRoom />;
  }

  return (
    <div className="relative flex-1">
      <Virtuoso
        key={roomId}
        ref={virtuosoRef}
        style={{ height: "100%" }}
        data={items}
        computeItemKey={computeTimelineItemKey}
        // Start mounted with the LAST item aligned to the END of the
        // viewport (i.e. fully visible at the bottom). Without
        // `align: 'end'` Virtuoso would put the last item at the *top*
        // of the viewport with empty space below.
        initialTopMostItemIndex={{ index: "LAST", align: "end" }}
        startReached={handleStartReached}
        atBottomStateChange={setIsAtBottom}
        atBottomThreshold={60}
        skipAnimationFrameInResizeObserver={true}
        increaseViewportBy={{ top: 400, bottom: 200 }}
        itemContent={(_index, item) => (
          <TimelineItemRenderer item={item} onReply={onReply} />
        )}
        components={{
          Header: () =>
            isLoadingHistory ? (
              <div className="flex justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--brand-purple)] border-t-transparent" />
              </div>
            ) : null,
        }}
      />

      {/* Only surface "↓ 新消息" when (a) the user has scrolled away from the
          bottom AND (b) the room actually has unread notifications.
          Otherwise scrolling up to read history shouldn't pretend there
          are pending messages. */}
      {!isAtBottom && unreadCount > 0 && (
        <NewMessageButton onClick={scrollToBottom} />
      )}
    </div>
  );
}

/** Stable identity per timeline row so Virtuoso doesn't re-mount items
 *  when the array reference is rebuilt by `useTimeline`'s useMemo. */
function computeTimelineItemKey(_index: number, item: TimelineItem): string {
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

function TimelineItemRenderer({
  item,
  onReply,
}: {
  item: TimelineItem;
  onReply?: (eventId: string) => void;
}) {
  switch (item.type) {
    case "message":
      return (
        <MessageBubble
          event={item.event}
          showSender={item.showSender}
          isOwn={item.isOwn}
          onReply={onReply}
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
