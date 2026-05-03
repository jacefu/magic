interface NewMessageButtonProps {
  onClick: () => void;
}

export function NewMessageButton({ onClick }: NewMessageButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full
                 bg-[var(--brand-purple)] px-4 py-1.5 text-xs font-medium text-white
                 shadow-lg transition-all hover:opacity-90"
    >
      ↓ 新消息
    </button>
  );
}
