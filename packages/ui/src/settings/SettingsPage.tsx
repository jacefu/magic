import { useState } from "react";
import { NotificationSettings } from "../notifications/NotificationSettings.js";
import { DialogOverlay } from "../common/DialogOverlay.js";
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
  servers: "Magic 实例",
  appearance: "外观",
  notifications: "通知",
  language: "语言",
  security: "设备管理",
};

/**
 * Centered settings dialog.
 *
 * Layout:
 *   ┌────────────┬────────────────────────┬───┐
 *   │  nav       │    content area        │ ✕ │
 *   └────────────┴────────────────────────┴───┘
 *
 * Wrapped in DialogOverlay (portal + ESC + click-outside dismissal).
 * Was full-screen before — now a centered floating window so the
 * underlying chat stays partially visible and switching back is one
 * click. Sized with a generous max but always inside a viewport
 * margin so it doesn't get clipped on small screens.
 */
export function SettingsPage({ onClose }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  return (
    <DialogOverlay onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-[960px] overflow-hidden rounded-[14px] border-[0.5px] border-[var(--border-default)]"
        style={{
          background: "var(--bg-primary)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          animation: "fade-in-up 0.2s ease-out",
          height: "min(720px, 90vh)",
        }}
      >
        {/* Nav rail — fixed width inside the dialog */}
        <div
          className="shrink-0 overflow-y-auto bg-[var(--bg-glass)]"
          style={{ width: 220 }}
        >
          <SettingsNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-y-auto">
            <SettingsSection title={TAB_TITLES[activeTab]}>
              {activeTab === "account" && <AccountSection />}
              {activeTab === "servers" && <ServersSection />}
              {activeTab === "appearance" && <AppearanceSection />}
              {activeTab === "notifications" && <NotificationSettings />}
              {activeTab === "language" && <LanguageSection />}
              {activeTab === "security" && <SecuritySection />}
            </SettingsSection>
          </div>

          {/* Close button */}
          <div className="flex shrink-0 items-start gap-2 pr-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              title="关闭设置 (ESC)"
              className="flex h-8 w-8 items-center justify-center rounded-full
                         border border-[var(--text-tertiary)] text-[var(--text-secondary)]
                         transition-colors hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
            >
              <svg
                className="h-3.5 w-3.5"
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
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
}
