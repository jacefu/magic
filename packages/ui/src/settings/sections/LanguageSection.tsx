import { SettingsRadioGroup } from "../components/SettingsRadioGroup.js";
import { useSettings } from "../../hooks/useSettings.js";

export function LanguageSection() {
  const { language, setLanguage } = useSettings();

  return (
    <SettingsRadioGroup
      label="界面语言"
      options={[
        { value: "zh", label: "简体中文", description: "默认" },
        { value: "en", label: "English", description: "Beta — 部分翻译尚未完成" },
      ]}
      value={language}
      onChange={setLanguage}
    />
  );
}
