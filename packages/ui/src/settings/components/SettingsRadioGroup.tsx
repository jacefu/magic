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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.4)]">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 transition-colors ${
              value === opt.value ? "bg-[rgba(255,255,255,0.06)]" : "hover:bg-[rgba(255,255,255,0.04)]"
            }`}
          >
            <input
              type="radio"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="mt-0.5 accent-[#6C5CE7]"
            />
            <div className="min-w-0">
              <p className="text-sm text-[rgba(255,255,255,0.85)]">{opt.label}</p>
              {opt.description && (
                <p className="text-xs text-[rgba(255,255,255,0.2)]">{opt.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
