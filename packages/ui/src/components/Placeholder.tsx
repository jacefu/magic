interface PlaceholderProps {
  label?: string;
}

export function Placeholder({ label = "Placeholder" }: PlaceholderProps) {
  return (
    <div className="flex items-center justify-center p-4 text-[var(--text-secondary)] border border-dashed border-[var(--border-default)] rounded">
      {label}
    </div>
  );
}
