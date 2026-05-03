import { memo } from "react";

interface TypingIndicatorProps {
  users: string[];
}

export const TypingIndicator = memo(function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const names = users.map((u) => {
    const match = u.match(/^@([^:]+)/);
    return match ? match[1] : u;
  });

  let text: string;
  if (names.length === 1) {
    text = `${names[0]} 正在输入`;
  } else if (names.length === 2) {
    text = `${names[0]} 和 ${names[1]} 正在输入`;
  } else {
    text = `${names[0]} 等 ${names.length} 人正在输入`;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <BouncingDots />
      <span className="text-xs text-[var(--text-secondary)]">{text}</span>
    </div>
  );
});

function BouncingDots() {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-text-faint"
          style={{ animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </div>
  );
}
