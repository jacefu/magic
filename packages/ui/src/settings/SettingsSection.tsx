import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="flex-1 px-10 pt-16 pb-12 overflow-y-auto">
      <h1 className="mb-6 text-xl font-semibold text-[#DBDEE1]">{title}</h1>
      {children}
    </div>
  );
}
