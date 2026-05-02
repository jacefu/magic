import { SettingsRadioGroup } from "../components/SettingsRadioGroup.js";
import { useSettings } from "../../hooks/useSettings.js";

export function AppearanceSection() {
  const { theme, setTheme } = useSettings();

  return (
    <div className="space-y-6">
      <SettingsRadioGroup
        label="主题"
        options={[
          {
            value: "dark",
            label: "深色（推荐）",
            description: "Discord Onyx 主题，适合长时间阅读",
          },
          {
            value: "system",
            label: "跟随系统",
            description: "根据操作系统的外观偏好自动切换",
          },
          {
            value: "light",
            label: "浅色",
            description: "目前为预览，部分组件仍以深色呈现",
          },
        ]}
        value={theme}
        onChange={setTheme}
      />
    </div>
  );
}
