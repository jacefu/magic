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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#949BA4]">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 transition-colors ${
              value === opt.value ? "bg-[#404249]" : "hover:bg-[#35373C]"
            }`}
          >
            <input
              type="radio"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="mt-0.5 accent-[#5865F2]"
            />
            <div className="min-w-0">
              <p className="text-sm text-[#DBDEE1]">{opt.label}</p>
              {opt.description && (
                <p className="text-xs text-[#6D6F78]">{opt.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
