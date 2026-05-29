import { useEffect, useState } from "react";
import { isElectron } from "../../hooks/useElectronAPI.js";

/**
 * Spec 022 v6 §7.2 — global system-prompt editor.
 *
 * Persists to `~/.agentteams/agentteams.md`. Every user message in
 * every bound room picks this up via `getSystemContext()` and
 * prepends it to the workspace-context block — basically a CLAUDE.md
 * /AGENTS.md analogue scoped to the App rather than any individual
 * project.
 *
 * Web build has nothing to show; the workspace feature is
 * desktop-only.
 */
export function WorkspaceContextSection() {
  const [draft, setDraft] = useState("");
  const [initial, setInitial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isElectron()) {
      setLoading(false);
      return;
    }
    const api = window.electronAPI?.workspace;
    if (!api) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .getGlobalContext()
      .then((txt) => {
        if (cancelled) return;
        setDraft(txt);
        setInitial(txt);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isElectron()) {
    return (
      <p className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
        仅桌面版支持工作区上下文。
      </p>
    );
  }

  const dirty = draft !== initial;
  const handleSave = async () => {
    const api = window.electronAPI?.workspace;
    if (!api) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.setGlobalContext(draft);
      setInitial(draft);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 px-2">
      <p
        className="text-[11.5px] leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        全局系统提示词。在<strong>所有</strong>绑定了本地工作区的对话里，
        每条你发出的消息都会附带这段文字，类似 CLAUDE.md / AGENTS.md。
        存放位置：<span className="font-mono text-[11px]">~/.agentteams/agentteams.md</span>。
      </p>

      {loading ? (
        <p
          className="text-[11px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          加载中…
        </p>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSaved(false);
            }}
            rows={14}
            placeholder={
              "# AgentTeams 全局说明\n回复请用中文，简洁清晰。\n涉及代码时，优先给出可直接运行的完整代码。\n不确定时先问，不要臆测。"
            }
            className="w-full resize-y rounded-md px-3 py-2.5 text-[12px] leading-[1.55] outline-none transition-colors focus:border-[var(--border-active)]"
            style={{
              background: "var(--bg-surface)",
              border: "0.5px solid var(--border-default)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              minHeight: 220,
            }}
          />
          <div className="flex items-center justify-between">
            <span
              className="text-[10.5px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {draft.length} 字符
              {saved && !dirty && (
                <span
                  className="ml-2"
                  style={{ color: "var(--color-success)" }}
                >
                  已保存
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="rounded-md px-4 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
              style={{ background: "var(--gradient-button)" }}
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
