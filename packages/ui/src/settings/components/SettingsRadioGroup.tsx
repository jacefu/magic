interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface SettingsRadioGroupProps<T extends string> {
  label?: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (v: T) => void;
}

export function SettingsRadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: SettingsRadioGroupProps<T>) {
  return (
    <div>
      {label && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 transition-colors ${
              value === opt.value ? "bg-[var(--ws-icon-bg)]" : "hover:bg-[var(--bg-surface)]"
            }`}
          >
            <input
              type="radio"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="mt-0.5 accent-[var(--brand-purple)]"
            />
            <div className="min-w-0">
              <p className="text-sm text-[var(--text-primary)]">{opt.label}</p>
              {opt.description && (
                <p className="text-xs text-[var(--text-tertiary)]">{opt.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
