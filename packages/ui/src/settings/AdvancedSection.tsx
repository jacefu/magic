import { useCallback, useState } from "react";
import { useRoomStore } from "@magic/matrix-client";
import type { RoomSettings } from "../hooks/useRoomSettings.js";
import { SectionTitle, SettingRow } from "./roomSettingsPrimitives.js";

interface AdvancedSectionProps {
  settings: RoomSettings;
  onLeave: () => Promise<void>;
}

export function AdvancedSection({ settings, onLeave }: AdvancedSectionProps) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLeave = useCallback(async () => {
    setIsLeaving(true);
    setError(null);
    try {
      await onLeave();
      // Clear active room — bridge.ts will remove this room from the
      // store on the next /sync via RoomEvent.MyMembership leave.
      useRoomStore.getState().setActiveRoom(null);
    } catch (err) {
      setError((err as Error).message ?? "离开失败");
    } finally {
      setIsLeaving(false);
      setConfirmLeave(false);
    }
  }, [onLeave]);

  const noun = settings.isDirect ? "对话" : "房间";

  return (
    <div>
      <SectionTitle>高级</SectionTitle>

      <SettingRow label={`${noun} ID`}>
        <span
          className="select-all break-all font-mono text-[10px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {settings.roomId}
        </span>
      </SettingRow>

      {!settings.isDirect && (
        <SettingRow label="房间版本">
          <span
            className="text-xs"
            style={{ color: "var(--text-tertiary)" }}
          >
            v{settings.roomVersion}
          </span>
        </SettingRow>
      )}

      <SettingRow label="成员数">
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {settings.memberCount}
        </span>
      </SettingRow>

      <div className="mt-3 px-1">
        {confirmLeave ? (
          <div
            className="rounded-lg p-3"
            style={{ background: "rgba(244,63,94,0.1)" }}
          >
            <p
              className="text-xs"
              style={{ color: "var(--color-danger)" }}
            >
              确定要离开此{noun}吗？
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                disabled={isLeaving}
                className="rounded px-3 py-1 text-xs disabled:opacity-50"
                style={{ color: "var(--text-secondary)" }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleLeave()}
                disabled={isLeaving}
                className="rounded px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                style={{ background: "var(--color-danger)" }}
              >
                {isLeaving ? "离开中…" : "确定离开"}
              </button>
            </div>
            {error && (
              <p
                className="mt-2 text-[10px]"
                style={{ color: "var(--color-danger)" }}
              >
                {error}
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            className="w-full rounded-lg px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              color: "var(--color-danger)",
              background: "rgba(244,63,94,0.08)",
            }}
          >
            离开{noun}
          </button>
        )}
      </div>
    </div>
  );
}
