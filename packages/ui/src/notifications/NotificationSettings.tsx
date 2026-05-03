import {
  useNotificationStore,
  type NotificationLevel,
} from "@magic/matrix-client";

interface LevelOption {
  value: NotificationLevel;
  label: string;
  desc: string;
}

const LEVEL_OPTIONS: LevelOption[] = [
  { value: "all", label: "全部消息", desc: "所有新消息都通知" },
  { value: "mentions", label: "仅 @提及", desc: "只在被 @mention 时通知" },
  { value: "mute", label: "静音", desc: "不接收任何通知" },
];

export function NotificationSettings() {
  const level = useNotificationStore((s) => s.level);
  const dnd = useNotificationStore((s) => s.dnd);
  const soundEnabled = useNotificationStore((s) => s.soundEnabled);
  const setLevel = useNotificationStore((s) => s.setLevel);
  const setDnd = useNotificationStore((s) => s.setDnd);
  const setSoundEnabled = useNotificationStore((s) => s.setSoundEnabled);

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">通知设置</h3>

      <label className="flex items-center justify-between">
        <span className="text-sm text-[var(--text-secondary)]">勿扰模式</span>
        <ToggleSwitch checked={dnd} onChange={setDnd} />
      </label>

      <div>
        <p className="mb-2 text-xs text-[var(--text-secondary)]">通知级别</p>
        <div className="space-y-1">
          {LEVEL_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2
                          transition-colors ${
                            level === opt.value
                              ? "bg-[var(--ws-icon-bg)]"
                              : "hover:bg-[var(--bg-surface)]"
                          }`}
            >
              <input
                type="radio"
                name="notif-level"
                value={opt.value}
                checked={level === opt.value}
                onChange={() => setLevel(opt.value)}
                className="accent-[var(--brand-purple)]"
              />
              <div>
                <p className="text-sm text-[var(--text-primary)]">{opt.label}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center justify-between">
        <span className="text-sm text-[var(--text-secondary)]">通知声音</span>
        <ToggleSwitch checked={soundEnabled} onChange={setSoundEnabled} />
      </label>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition-colors ${
        checked ? "" : "bg-[rgba(255,255,255,0.15)]"
      }`}
      style={
        checked
          ? { background: "var(--gradient-button)" }
          : undefined
      }
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
