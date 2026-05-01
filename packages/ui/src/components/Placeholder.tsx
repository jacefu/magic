interface PlaceholderProps {
  label?: string;
}

export function Placeholder({ label = "Placeholder" }: PlaceholderProps) {
  return (
    <div className="flex items-center justify-center p-4 text-text-muted border border-dashed border-divider rounded">
      {label}
    </div>
  );
}
