import { memo } from "react";

interface TypingIndicatorProps {
  users: string[];
}

// Spec 020 FIX-4 — three bouncing dots. The `.typing-dot` class is
// defined in index.css with a staggered animation; `animationDelay`
// inline gives each dot its own phase so the bounce travels left to
// right.
export const TypingIndicator = memo(function TypingIndicator({
  users,
}: TypingIndicatorProps) {
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
    <div className="flex items-center gap-2 px-4 py-1.5">
      <span className="inline-flex items-center gap-[3px]">
        <span className="typing-dot" style={{ animationDelay: "0ms" }} />
        <span className="typing-dot" style={{ animationDelay: "150ms" }} />
        <span className="typing-dot" style={{ animationDelay: "300ms" }} />
      </span>
      <span className="text-xs text-[var(--text-secondary)]">{text}</span>
    </div>
  );
});
