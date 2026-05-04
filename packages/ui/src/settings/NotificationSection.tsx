import { useEffect, useState } from "react";
import type { NotificationMode } from "../hooks/useRoomSettings.js";
import { SectionTitle } from "./roomSettingsPrimitives.js";

interface NotificationSectionProps {
  roomId: string;
  readPersistedPrefs: () => { mode: NotificationMode; isFavourite: boolean };
  onSetMode: (mode: NotificationMode) => Promise<void>;
  onToggleFavourite: () => Promise<void>;
}

const MODES: { value: NotificationMode; label: string; hint: string }[] = [
  { value: "all", label: "全部消息", hint: "新消息都会发出通知" },
  { value: "mentions", label: "仅 @提及", hint: "只在被 @ 时通知" },
  { value: "mute", label: "静音", hint: "不接收任何通知" },
];

export function NotificationSection({
  roomId,
  readPersistedPrefs,
  onSetMode,
  onToggleFavourite,
}: NotificationSectionProps) {
  const [mode, setMode] = useState<NotificationMode>("all");
  const [isFavourite, setIsFavourite] = useState(false);

  useEffect(() => {
    const { mode: m, isFavourite: f } = readPersistedPrefs();
    setMode(m);
    setIsFavourite(f);
  }, [roomId, readPersistedPrefs]);

  return (
    <div>
      <SectionTitle>通知</SectionTitle>

      <div className="space-y-1 px-1">
        {MODES.map((m) => {
          const active = mode === m.value;
          return (
            <label
              key={m.value}
              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--bg-surface)]"
              style={
                active ? { background: "var(--bg-surface)" } : undefined
              }
            >
              <input
                type="radio"
                name={`notif-mode-${roomId}`}
                checked={active}
                onChange={() => {
                  setMode(m.value);
                  void onSetMode(m.value);
                }}
                className="mt-[3px] h-3 w-3 accent-[var(--brand-purple)]"
              />
              <div className="min-w-0 flex-1">
                <p
                  className="text-xs"
                  style={{ color: "var(--text-primary)" }}
                >
                  {m.label}
                </p>
                <p
                  className="text-[10px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {m.hint}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      <label className="mt-2 flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--bg-surface)]">
        <span className="text-xs" style={{ color: "var(--text-primary)" }}>
          置顶
        </span>
        <input
          type="checkbox"
          checked={isFavourite}
          onChange={() => {
            setIsFavourite((v) => !v);
            void onToggleFavourite();
          }}
          className="h-4 w-4 rounded accent-[var(--brand-purple)]"
        />
      </label>
    </div>
  );
}
