export type SettingsTab =
  | "account"
  | "servers"
  | "appearance"
  | "notifications"
  | "language"
  | "security";

interface NavGroup {
  label: string;
  items: { key: SettingsTab; label: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "用户设置",
    items: [
      { key: "account", label: "账户" },
      { key: "servers", label: "服务器管理" },
      { key: "appearance", label: "外观" },
      { key: "notifications", label: "通知" },
    ],
  },
  {
    label: "应用设置",
    items: [{ key: "language", label: "语言" }],
  },
  {
    label: "安全",
    items: [{ key: "security", label: "设备管理" }],
  },
];

interface SettingsNavProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export function SettingsNav({ activeTab, onTabChange }: SettingsNavProps) {
  return (
    <nav className="w-[218px] shrink-0 px-3 pt-16 pb-4">
      {NAV_GROUPS.map((group, idx) => (
        <div key={group.label} className={idx === 0 ? "" : "mt-5"}>
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onTabChange(item.key)}
                  className={`flex w-full items-center rounded-sm px-2 py-1.5 text-left
                              text-sm transition-colors ${
                                activeTab === item.key
                                  ? "bg-[var(--ws-icon-bg)] text-[var(--text-primary)]"
                                  : "text-[#B5BAC1] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                              }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
