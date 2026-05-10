import {
  removeServer,
  switchSession,
  updateServerAppearance,
  useSessionStore,
  useUIStore,
  type ServerSession,
} from "@magic/matrix-client";
import { useMemo, useState } from "react";
import { AddServerDialog } from "../../workspace/AddServerDialog.js";
import { DialogOverlay } from "../../common/DialogOverlay.js";

export function ServersSection() {
  // Sort in useMemo (not via a Zustand getter) — returning a fresh
  // sorted array from a Zustand selector each call triggers an
  // infinite render loop because the reference is never stable.
  const sessionsRecord = useSessionStore((s) => s.sessions);
  const sessions = useMemo(
    () =>
      Object.values(sessionsRecord).sort((a, b) => a.addedAt - b.addedAt),
    [sessionsRecord],
  );
  const activeId = useSessionStore((s) => s.activeSessionId);
  const closeSettings = useUIStore((s) => s.closeSettings);
  const [showAdd, setShowAdd] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

  const handleRemove = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const ok = window.confirm(
      `确定要断开 ${session.serverName}（${session.homeserver}）吗？\n断开后需要重新登录才能恢复。`,
    );
    if (!ok) return;
    await removeServer(sessionId);
    if (Object.keys(useSessionStore.getState().sessions).length === 0) {
      closeSettings();
    }
  };

  const editingSession = editingSessionId
    ? (sessions.find((s) => s.id === editingSessionId) ?? null)
    : null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-[var(--text-secondary)]">
          你已登录 {sessions.length} 个 Matrix 服务器。每个服务器在左侧栏显示为独立的工作区图标。
        </p>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white
                     transition-opacity hover:opacity-90"
          style={{
            background: "var(--gradient-button)",
          }}
        >
          + 添加服务器
        </button>
      </div>

      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
              session.id === activeId
                ? "border border-[var(--border-active)] bg-[var(--bg-surface)]"
                : "bg-[var(--bg-glass)]"
            }`}
          >
            <button
              type="button"
              onClick={() => switchSession(session.id)}
              title={`切换到 ${session.serverName}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white transition-transform hover:scale-105"
              style={{ backgroundColor: session.serverColor ?? "#5865F2" }}
            >
              {session.serverInitial}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {session.serverName}
                </p>
                {session.id === activeId && (
                  <span className="shrink-0 rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--brand-purple)]">
                    当前
                  </span>
                )}
                <SyncBadge state={session.syncState} />
              </div>
              <p className="truncate text-xs text-[var(--text-tertiary)]">{session.userId}</p>
              <p className="truncate text-xs text-[var(--text-tertiary)]">
                {session.homeserver}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setEditingSessionId(session.id)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-[var(--text-secondary)]
                         transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            >
              编辑
            </button>
            <button
              type="button"
              onClick={() => handleRemove(session.id)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-[var(--color-danger)]
                         transition-colors hover:bg-[var(--color-danger)]/10"
            >
              断开
            </button>
          </div>
        ))}
      </div>

      {showAdd && <AddServerDialog onClose={() => setShowAdd(false)} />}
      {editingSession && (
        <ServerAppearanceDialog
          session={editingSession}
          onClose={() => setEditingSessionId(null)}
        />
      )}
    </div>
  );
}

/** Allowed colours for the server icon. Same palette
 *  matrix-client/session-manager.ts uses to seed defaults — keeps the
 *  picker visually consistent across sessions. */
const ICON_COLORS: { value: string; name: string }[] = [
  { value: "#5865F2", name: "蓝紫" },
  { value: "#23A55A", name: "翠绿" },
  { value: "#F0B232", name: "琥珀" },
  { value: "#EB459E", name: "玫红" },
  { value: "#ED4245", name: "丹红" },
  { value: "#57F287", name: "薄荷" },
  { value: "#FEE75C", name: "明黄" },
  { value: "#6C5CE7", name: "品牌紫" },
  { value: "#00B4D8", name: "品牌青" },
  { value: "#00F5A0", name: "品牌翠" },
];

function ServerAppearanceDialog({
  session,
  onClose,
}: {
  session: ServerSession;
  onClose: () => void;
}) {
  const [name, setName] = useState(session.serverName);
  const [initial, setInitial] = useState(session.serverInitial);
  const [color, setColor] = useState(session.serverColor ?? "#5865F2");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedInitial = initial.trim().slice(0, 2);
  const canSave =
    !!trimmedName &&
    !!trimmedInitial &&
    !saving &&
    (trimmedName !== session.serverName ||
      trimmedInitial !== session.serverInitial ||
      color !== (session.serverColor ?? "#5865F2"));

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await updateServerAppearance(session.id, {
        serverName: trimmedName,
        serverInitial: trimmedInitial,
        serverColor: color,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setSaving(false);
    }
  };

  return (
    <DialogOverlay onClose={saving ? () => {} : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[14px] border-[0.5px] border-[var(--border-default)] p-5"
        style={{
          background: "var(--bg-primary)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          animation: "fade-in-up 0.2s ease-out",
        }}
      >
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          编辑服务器图标
        </h2>
        <p
          className="mt-1 text-[11px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          仅修改本地显示，不影响服务器上的设置。
        </p>

        {/* Live preview */}
        <div className="mt-4 flex items-center gap-3 rounded-lg p-3"
             style={{ background: "var(--bg-surface)" }}>
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {trimmedInitial || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {trimmedName || "(未命名)"}
            </p>
            <p
              className="truncate text-[11px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {session.homeserver}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span
              className="mb-1 block text-[11px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              服务器名称
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              disabled={saving}
              className="w-full rounded-md border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span
              className="mb-1 block text-[11px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              图标字母（1–2 字符）
            </span>
            <input
              type="text"
              value={initial}
              onChange={(e) => setInitial(e.target.value.slice(0, 2))}
              maxLength={2}
              disabled={saving}
              className="w-24 rounded-md border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-center text-base font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--border-active)] disabled:opacity-50"
            />
          </label>

          <div>
            <span
              className="mb-1.5 block text-[11px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              图标颜色
            </span>
            <div className="flex flex-wrap gap-2">
              {ICON_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  disabled={saving}
                  title={c.name}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 disabled:opacity-50 ${
                    color === c.value
                      ? "ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--bg-primary)]"
                      : ""
                  }`}
                  style={{ background: c.value }}
                />
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border-[0.5px] border-[var(--border-default)] bg-transparent px-4 py-1.5 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="rounded-md px-4 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
            style={{ background: "var(--gradient-button)" }}
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

function SyncBadge({ state }: { state: string }) {
  if (state === "PREPARED")
    return <span className="text-[10px] text-[var(--color-success)]">● 已连接</span>;
  if (state === "SYNCING")
    return <span className="text-[10px] text-[var(--color-warning)]">● 同步中</span>;
  if (state === "ERROR")
    return <span className="text-[10px] text-[var(--color-danger)]">● 连接错误</span>;
  if (state === "RECONNECTING")
    return <span className="text-[10px] text-[var(--color-warning)]">● 重连中</span>;
  return <span className="text-[10px] text-[var(--text-tertiary)]">● 已断开</span>;
}
