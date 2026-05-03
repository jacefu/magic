import { useEffect, useState } from "react";
import { NotificationSettings } from "../notifications/NotificationSettings.js";
import { SettingsNav, type SettingsTab } from "./SettingsNav.js";
import { SettingsSection } from "./SettingsSection.js";
import { AccountSection } from "./sections/AccountSection.js";
import { AppearanceSection } from "./sections/AppearanceSection.js";
import { LanguageSection } from "./sections/LanguageSection.js";
import { SecuritySection } from "./sections/SecuritySection.js";
import { ServersSection } from "./sections/ServersSection.js";

interface SettingsPageProps {
  onClose: () => void;
}

const TAB_TITLES: Record<SettingsTab, string> = {
  account: "账户",
  servers: "服务器管理",
  appearance: "外观",
  notifications: "通知",
  language: "语言",
  security: "设备管理",
};

/**
 * Full-screen Discord-style settings overlay.
 *
 * Layout:
 *   ┌─────────┬──────────────────────────┬───────┐
 *   │  nav    │     content area          │  ✕   │
 *   └─────────┴──────────────────────────┴───────┘
 *
 * ESC closes; the close button is in the top-right gutter so the
 * content column stays a fixed reading width.
 */
export function SettingsPage({ onClose }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex bg-[var(--bg-primary)]">
      {/* Left gutter — pads the nav so it sits flush to the centre column */}
      <div
        className="flex justify-end bg-[var(--bg-glass)]"
        style={{ flex: "1 0 218px" }}
      >
        <SettingsNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Centre content */}
      <div
        className="flex"
        style={{ flex: "1 1 800px", maxWidth: "740px" }}
      >
        <SettingsSection title={TAB_TITLES[activeTab]}>
          {activeTab === "account" && <AccountSection />}
          {activeTab === "servers" && <ServersSection />}
          {activeTab === "appearance" && <AppearanceSection />}
          {activeTab === "notifications" && <NotificationSettings />}
          {activeTab === "language" && <LanguageSection />}
          {activeTab === "security" && <SecuritySection />}
        </SettingsSection>

        {/* Close button — vertically aligned with the title */}
        <div className="flex shrink-0 items-start gap-2 pr-4 pt-16">
          <button
            type="button"
            onClick={onClose}
            title="关闭设置 (ESC)"
            className="flex h-9 w-9 items-center justify-center rounded-full
                       border border-[#6D6F78] text-[var(--text-secondary)]
                       transition-colors hover:border-[#DBDEE1] hover:text-[var(--text-primary)]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <span className="mt-2.5 text-[10px] text-[var(--text-tertiary)]">ESC</span>
        </div>
      </div>

      {/* Right gutter — eats the remaining space so the content stays
          left-aligned within its 740px column */}
      <div style={{ flex: "1 0 0" }} />
    </div>
  );
}
