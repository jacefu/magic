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
        <p className="mb-1 text-sm font-medium text-[#DBDEE1]">{label}</p>
      )}
      {description && (
        <p className="mb-2 text-xs text-[#949BA4]">{description}</p>
      )}
      <input
        {...rest}
        className={`w-full rounded-md border border-[#3F4147] bg-[#1E1F22] px-3 py-2
                    text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                    focus:border-[#5865F2] focus:outline-none disabled:opacity-50 ${className}`}
      />
    </div>
  );
}
