import { useCallback, useState } from "react";
import type { RoomSettings } from "../hooks/useRoomSettings.js";
import { SectionTitle, SettingRow } from "./roomSettingsPrimitives.js";

interface RoomInfoSectionProps {
  settings: RoomSettings;
  isSaving: boolean;
  error: string | null;
  onSetName: (name: string) => Promise<void>;
  onSetTopic: (topic: string) => Promise<void>;
}

export function RoomInfoSection({
  settings,
  isSaving,
  error,
  onSetName,
  onSetTopic,
}: RoomInfoSectionProps) {
  const [editingName, setEditingName] = useState(false);
  const [editingTopic, setEditingTopic] = useState(false);
  const [nameValue, setNameValue] = useState(settings.name);
  const [topicValue, setTopicValue] = useState(settings.topic);

  const handleSaveName = useCallback(async () => {
    if (nameValue.trim() && nameValue.trim() !== settings.name) {
      await onSetName(nameValue.trim());
    }
    setEditingName(false);
  }, [nameValue, settings.name, onSetName]);

  const handleSaveTopic = useCallback(async () => {
    if (topicValue.trim() !== settings.topic) {
      await onSetTopic(topicValue.trim());
    }
    setEditingTopic(false);
  }, [topicValue, settings.topic, onSetTopic]);

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    border: "0.5px solid var(--border-hover)",
  };

  return (
    <div>
      <SectionTitle>房间信息</SectionTitle>

      <SettingRow label="房间名称">
        {editingName ? (
          <div className="flex gap-1">
            <input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSaveName();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="flex-1 rounded px-2 py-1 text-xs outline-none"
              style={inputStyle}
              autoFocus
            />
            <button
              type="button"
              onClick={() => void handleSaveName()}
              disabled={isSaving}
              className="rounded px-2 py-1 text-[10px] font-medium text-white disabled:opacity-50"
              style={{ background: "var(--gradient-button)" }}
            >
              保存
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span
              className="truncate text-xs"
              style={{ color: "var(--text-primary)" }}
            >
              {settings.name || "未命名"}
            </span>
            {settings.canEditInfo && (
              <button
                type="button"
                onClick={() => {
                  setNameValue(settings.name);
                  setEditingName(true);
                }}
                className="shrink-0 text-[10px] hover:text-[var(--text-primary)]"
                style={{ color: "var(--text-tertiary)" }}
              >
                编辑
              </button>
            )}
          </div>
        )}
      </SettingRow>

      <SettingRow label="话题">
        {editingTopic ? (
          <div className="flex flex-col gap-1">
            <textarea
              value={topicValue}
              onChange={(e) => setTopicValue(e.target.value)}
              rows={2}
              className="w-full resize-none rounded px-2 py-1 text-xs outline-none"
              style={inputStyle}
              autoFocus
            />
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={() => setEditingTopic(false)}
                className="rounded px-2 py-1 text-[10px]"
                style={{ color: "var(--text-secondary)" }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleSaveTopic()}
                disabled={isSaving}
                className="rounded px-2 py-1 text-[10px] font-medium text-white disabled:opacity-50"
                style={{ background: "var(--gradient-button)" }}
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span
              className="truncate text-xs"
              style={{
                color: settings.topic
                  ? "var(--text-secondary)"
                  : "var(--text-tertiary)",
              }}
            >
              {settings.topic || "无话题"}
            </span>
            {settings.canEditInfo && (
              <button
                type="button"
                onClick={() => {
                  setTopicValue(settings.topic);
                  setEditingTopic(true);
                }}
                className="shrink-0 text-[10px] hover:text-[var(--text-primary)]"
                style={{ color: "var(--text-tertiary)" }}
              >
                编辑
              </button>
            )}
          </div>
        )}
      </SettingRow>

      {error && (
        <p
          className="mt-1 px-2 text-[10px]"
          style={{ color: "var(--color-danger)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
