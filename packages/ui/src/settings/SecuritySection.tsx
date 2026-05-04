import type { RoomSettings } from "../hooks/useRoomSettings.js";
import { SectionTitle, SettingRow } from "./roomSettingsPrimitives.js";

interface SecuritySectionProps {
  settings: RoomSettings;
}

export function SecuritySection({ settings }: SecuritySectionProps) {
  return (
    <div>
      <SectionTitle>安全</SectionTitle>

      <SettingRow label="端到端加密">
        <span
          className="text-xs"
          style={{
            color: settings.isEncrypted
              ? "var(--color-success)"
              : "var(--text-tertiary)",
          }}
        >
          {settings.isEncrypted ? "已启用" : "未启用"}
        </span>
      </SettingRow>

      {settings.isEncrypted ? (
        <p
          className="px-2 text-[10px] leading-relaxed"
          style={{ color: "var(--text-tertiary)" }}
        >
          此房间的消息使用端到端加密保护，仅房间成员能阅读。加密一旦启用便无法关闭。
        </p>
      ) : (
        <p
          className="px-2 text-[10px] leading-relaxed"
          style={{ color: "var(--text-tertiary)" }}
        >
          此房间未启用加密。在创建房间或私聊时勾选「启用端到端加密」即可开启，开启后无法关闭。
        </p>
      )}
    </div>
  );
}
