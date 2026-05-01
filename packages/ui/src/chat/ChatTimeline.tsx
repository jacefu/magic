import { useCallback, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { paginateBackwards, useAuthStore } from "@magic/matrix-client";
import { useTimeline, type TimelineItem } from "../hooks/useTimeline.js";
import { MessageBubble } from "./MessageBubble.js";
import { DateSeparator } from "./DateSeparator.js";
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
  const { items, messageCount } = useTimeline({ roomId, currentUserId });
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

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
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
              </div>
            ) : null,
        }}
      />

      {!isAtBottom && <NewMessageButton onClick={scrollToBottom} />}
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
    case "typing":
      return <TypingIndicator users={item.users} />;
    default:
      return null;
  }
}
