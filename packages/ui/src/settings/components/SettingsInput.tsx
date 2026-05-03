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
        <p className="mb-1 text-sm font-medium text-[rgba(255,255,255,0.85)]">{label}</p>
      )}
      {description && (
        <p className="mb-2 text-xs text-[rgba(255,255,255,0.4)]">{description}</p>
      )}
      <input
        {...rest}
        className={`w-full rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(12,12,18,0.95)] px-3 py-2
                    text-sm text-[rgba(255,255,255,0.85)] placeholder-[rgba(255,255,255,0.2)]
                    focus:border-[rgba(108,92,231,0.4)] focus:outline-none disabled:opacity-50 ${className}`}
      />
    </div>
  );
}
