import { useMemo, useState, type FormEvent } from "react";
import {
  addServer,
  getRecentInstances,
  type RecentInstance,
} from "@magic/matrix-client";
import { MagicAppIcon } from "../branding/MagicAppIcon.js";

/**
 * First-run welcome screen — shown by AuthGuard when no sessions exist.
 *
 * Layout:
 *   ┌────┬───────────────────────────────┐
 *   │ +  │   Logo + connect form +       │
 *   │    │   "recent instances" history  │
 *   └────┴───────────────────────────────┘
 *
 * Once `addServer` succeeds, sessionStore has its first session and
 * AuthGuard re-renders into the main UI. The quick-connect list at the
 * bottom is dynamic — it shows Magic instances the user has logged in
 * to before (recorded by `addServer` and persisted across logouts).
 */

export function WelcomePage() {
  const [homeserver, setHomeserver] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read once on mount — WelcomePage unmounts as soon as a session is
  // added (AuthGuard swaps in MainLayout), and re-mounts only after
  // logout, at which point the list is freshly read again.
  const recentInstances = useMemo<RecentInstance[]>(
    () => getRecentInstances(),
    [],
  );

  const canSubmit =
    homeserver.trim() !== "" &&
    username.trim() !== "" &&
    password.trim() !== "" &&
    !isLoading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);
    try {
      await addServer(homeserver.trim(), username.trim(), password);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Cosmic AI § 2.1 + 11.2 — auth surfaces sit on the deep-space body
  // (#0F0F14) with a glass card and a gradient brand mark. The
  // primary CTA uses the purple→blue brand-button gradient; quick-
  // connect rows are subtle glass tiles.
  const inputClasses =
    "w-full rounded-lg border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 " +
    "text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] " +
    "transition-colors focus:border-[var(--border-active)] focus:outline-none disabled:opacity-50";

  return (
    <div
      className="flex h-screen flex-col"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Top draggable bar — keeps the window movable before login. */}
      <div
        className="h-9 shrink-0"
        style={{
          background: "var(--bg-deepest)",
          WebkitAppRegion: "drag",
        } as React.CSSProperties}
      />

      <div className="flex min-h-0 flex-1">
        {/* Empty workspace rail — placeholder + button + vertical hint */}
        <div
          className="flex w-[72px] shrink-0 flex-col items-center pt-3"
          style={{ background: "var(--bg-deepest)" }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full
                       border-[1.5px] border-dashed border-[var(--text-tertiary)] text-lg text-[var(--text-secondary)]"
            aria-label="添加服务器"
          >
            +
          </div>
          <span
            className="mt-3 text-[10px] text-[var(--text-tertiary)]"
            style={{ writingMode: "vertical-rl" }}
          >
            添加服务器
          </span>
        </div>

        {/* Centred welcome card */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
          <div className="mb-8 text-center">
            {/* Spec 023 §7.4 — Magic brand mark on the welcome card. */}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center">
              <MagicAppIcon size={56} />
            </div>
            <h1 className="text-[22px] font-semibold text-[var(--text-primary)]">
              欢迎使用 MAGIC
            </h1>
            <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
              Multi-Agent Governance &amp; Intelligent Collaboration
            </p>
          </div>

          <div
            className="w-[380px] rounded-[14px] border-[0.5px] border-[var(--border-default)] px-8 py-7"
            style={{
              background: "var(--bg-glass)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
            }}
          >
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              连接 Magic 实例
            </h2>
            <p className="mb-5 mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              输入你的 Magic 实例地址和账号信息，开始多 Agent 协同工作
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  Magic 实例地址
                </label>
                <input
                  type="url"
                  value={homeserver}
                  onChange={(e) => setHomeserver(e.target.value)}
                  placeholder="https://matrix.magic.com"
                  autoFocus
                  disabled={isLoading}
                  className={inputClasses}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@user:magic.com 或 user"
                  disabled={isLoading}
                  autoComplete="username"
                  className={inputClasses}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入密码"
                  disabled={isLoading}
                  autoComplete="current-password"
                  className={inputClasses}
                />
              </div>

              {error && (
                <div className="rounded-lg border-[0.5px] border-[var(--color-danger)]/40 bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--color-danger)]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-lg py-2.5 text-sm font-medium text-white
                           transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{
                  background: "var(--gradient-button)",
                }}
              >
                {isLoading ? "连接中…" : "连接服务器"}
              </button>
            </form>

            {recentInstances.length > 0 && (
              <>
                <div className="my-5 flex items-center gap-3">
                  <div
                    className="h-px flex-1"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, var(--border-default), transparent)",
                    }}
                  />
                  <span className="text-[11px] text-[var(--text-tertiary)]">最近登录</span>
                  <div
                    className="h-px flex-1"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, var(--border-default), transparent)",
                    }}
                  />
                </div>

                <div className="space-y-2">
                  {recentInstances.map((instance) => (
                    <button
                      key={instance.url}
                      type="button"
                      onClick={() => {
                        setHomeserver(instance.url);
                        setUsername(instance.username);
                        setError(null);
                      }}
                      disabled={isLoading}
                      className="flex w-full items-center gap-3 rounded-lg border-[0.5px]
                                 border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5
                                 text-left transition-colors
                                 hover:border-[var(--border-active)] hover:bg-[var(--ws-icon-bg)]
                                 disabled:opacity-50"
                    >
                      {instance.iconDataUrl ? (
                        <img
                          src={instance.iconDataUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                          style={{ backgroundColor: instance.color }}
                        >
                          {instance.initial}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                          {instance.name}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-tertiary)]">
                          {instance.username} · {instance.url}
                        </p>
                      </div>
                      <span className="text-sm text-[var(--text-tertiary)]">→</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <p className="mt-6 text-[11px] text-[var(--text-tertiary)]">
            MAGIC Client v0.0.1 · 基于 Matrix 协议
          </p>
        </div>
      </div>
    </div>
  );
}

function parseError(err: unknown): string {
  const e = err as { message?: string; httpStatus?: number };
  const msg = e?.message ?? String(err);
  const status = e?.httpStatus;
  if (status === 403 || msg.includes("M_FORBIDDEN")) return "用户名或密码错误";
  if (status === 429 || msg.includes("M_LIMIT_EXCEEDED"))
    return "登录请求过于频繁，请稍后重试";
  if (msg.includes("服务器无响应")) return msg;
  if (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND")
  ) {
    return "无法连接到服务器，请检查地址";
  }
  return `连接失败: ${msg}`;
}
