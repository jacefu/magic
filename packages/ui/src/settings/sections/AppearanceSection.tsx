import { SettingsRadioGroup } from "../components/SettingsRadioGroup.js";
import { useSettings } from "../../hooks/useSettings.js";

/**
 * Theme picker per spec § 12.3 — three options, with `applyTheme`
 * called automatically by `useSettings` so the choice takes effect
 * synchronously on selection (no reload needed).
 */
export function AppearanceSection() {
  const { theme, setTheme } = useSettings();

  return (
    <div className="space-y-6">
      <SettingsRadioGroup
        label="主题"
        options={[
          {
            value: "dark",
            label: "暗色",
            description: "深空宇宙感（默认）",
          },
          {
            value: "light",
            label: "浅色",
            description: "明亮清新",
          },
          {
            value: "system",
            label: "跟随系统",
            description: "自动跟随操作系统外观",
          },
        ]}
        value={theme}
        onChange={setTheme}
      />
    </div>
  );
}
