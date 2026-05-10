interface NewMessageButtonProps {
  onClick: () => void;
  /**
   * Defaults to "↓ 新消息". When the timeline is scrolled up but no
   * unread messages exist, callers pass "↓ 最新消息" so the label
   * doesn't lie about pending content.
   */
  label?: string;
}

export function NewMessageButton({ onClick, label = "↓ 新消息" }: NewMessageButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full
                 bg-[var(--brand-purple)] px-4 py-1.5 text-xs font-medium text-white
                 shadow-lg transition-all hover:opacity-90"
    >
      {label}
    </button>
  );
}
