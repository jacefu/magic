interface PlaceholderProps {
  label?: string;
}

export function Placeholder({ label = "Placeholder" }: PlaceholderProps) {
  return (
    <div className="flex items-center justify-center p-4 text-gray-400 border border-dashed border-gray-600 rounded">
      {label}
    </div>
  );
}
