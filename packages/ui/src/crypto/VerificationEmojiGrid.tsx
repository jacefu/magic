interface VerificationEmojiGridProps {
  emoji: Array<[string, string]>;
}

export function VerificationEmojiGrid({ emoji }: VerificationEmojiGridProps) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {emoji.map(([symbol, name], i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="text-2xl">{symbol}</span>
          <span className="text-center text-[10px] leading-tight text-[var(--text-secondary)]">
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}
