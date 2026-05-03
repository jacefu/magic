interface SettingsToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function SettingsToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: SettingsToggleProps) {
  return (
    <label
      className={`flex items-center justify-between gap-4 ${
        disabled ? "opacity-50" : "cursor-pointer"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[rgba(255,255,255,0.85)]">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-[rgba(255,255,255,0.4)]">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "" : "bg-[rgba(255,255,255,0.15)]"
        } ${disabled ? "cursor-not-allowed" : ""}`}
        style={
          checked
            ? { background: "linear-gradient(135deg, #6C5CE7, #3B82F6)" }
            : undefined
        }
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}
