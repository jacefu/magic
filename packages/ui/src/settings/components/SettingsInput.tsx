import { type InputHTMLAttributes } from "react";

interface SettingsInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

export function SettingsInput({
  label,
  description,
  className = "",
  ...rest
}: SettingsInputProps) {
  return (
    <div>
      {label && (
        <p className="mb-1 text-sm font-medium text-[var(--text-primary)]">{label}</p>
      )}
      {description && (
        <p className="mb-2 text-xs text-[var(--text-secondary)]">{description}</p>
      )}
      <input
        {...rest}
        className={`w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-deepest)] px-3 py-2
                    text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
                    focus:border-[var(--border-active)] focus:outline-none disabled:opacity-50 ${className}`}
      />
    </div>
  );
}
