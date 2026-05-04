import type { ReactNode } from "react";

/**
 * Tiny shared primitives for the room-settings panel sections so the
 * sectioning + label + spacing stay visually consistent.
 */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p
      className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.06em]"
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </p>
  );
}

export function SettingRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded px-2 py-1.5">
      <p
        className="mb-0.5 text-[10px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

export function SettingsDivider() {
  return (
    <div
      className="my-2 h-px"
      style={{ background: "var(--border-default)" }}
    />
  );
}
