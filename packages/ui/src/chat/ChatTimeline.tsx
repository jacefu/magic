import { useCallback, useEffect, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import {
  getClient,
  hasClient,
  paginateBackwards,
  sendReadReceipt,
  useAuthStore,
  useRoomStore,
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
}

const START_INDEX = 100_000;

export function ChatTimeline({ roomId, onReply }: ChatTimelineProps) {
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
  const latestMessageEventId = useLatestMessageEventId(roomId);
  useEffect(() => {
    if (!isAtBottom || !latestMessageEventId) return;
    void sendReadReceipt(roomId, latestMessageEventId).catch(() => {
      /* best-effort */
    });
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

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({
      index: items.length - 1,
      behavior: "smooth",
    });
  }, [items.length]);

  if (messageCount === 0 && items.length === 0) {
    return <EmptyRoom />;
  }

  return (
    <div className="relative flex-1">
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: "100%" }}
        data={items}
        firstItemIndex={START_INDEX - items.length}
        initialTopMostItemIndex={items.length - 1}
        startReached={handleStartReached}
        followOutput={(isBottom) => (isBottom ? "smooth" : false)}
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
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
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
