import { useState, type FormEvent } from "react";
import { addServer } from "@magic/matrix-client";

/**
 * First-run welcome screen — shown by AuthGuard when no sessions exist.
 *
 * Layout:
 *   ┌────┬───────────────────────────────┐
 *   │ +  │   Logo + connect form +       │
 *   │    │   "or quick-connect" presets  │
 *   └────┴───────────────────────────────┘
 *
 * Once `addServer` succeeds, sessionStore has its first session and
 * AuthGuard re-renders into the main UI.
 */

interface QuickServer {
  name: string;
  url: string;
  initial: string;
  color: string;
}

const QUICK_SERVERS: QuickServer[] = [
  {
    name: "HiClaw 本地开发",
    url: "https://matrix-local.hiclaw.io:18080",
    initial: "H",
    color: "#23A55A",
  },
  {
    name: "Matrix.org 公共服务器",
    url: "https://matrix.org",
    initial: "M",
    color: "#5865F2",
  },
];

export function WelcomePage() {
  const [homeserver, setHomeserver] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    "w-full rounded-lg border-[0.5px] border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-3 py-2 " +
    "text-sm text-[rgba(255,255,255,0.85)] placeholder-[rgba(255,255,255,0.2)] " +
    "transition-colors focus:border-[rgba(108,92,231,0.4)] focus:outline-none disabled:opacity-50";

  return (
    <div
      className="flex h-screen flex-col"
      style={{ background: "#0F0F14" }}
    >
      {/* Top draggable bar — keeps the window movable before login. */}
      <div
        className="h-9 shrink-0"
        style={{
          background: "rgba(12,12,18,0.95)",
          WebkitAppRegion: "drag",
        } as React.CSSProperties}
      />

      <div className="flex min-h-0 flex-1">
        {/* Empty workspace rail — placeholder + button + vertical hint */}
        <div
          className="flex w-[72px] shrink-0 flex-col items-center pt-3"
          style={{ background: "rgba(12,12,18,0.95)" }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full
                       border-[1.5px] border-dashed border-[rgba(255,255,255,0.2)] text-lg text-[rgba(255,255,255,0.4)]"
            aria-label="添加服务器"
          >
            +
          </div>
          <span
            className="mt-3 text-[10px] text-[rgba(255,255,255,0.2)]"
            style={{ writingMode: "vertical-rl" }}
          >
            添加服务器
          </span>
        </div>

        {/* Centred welcome card */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
          <div className="mb-8 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[14px] text-[28px] font-semibold text-white"
              style={{
                background:
                  "linear-gradient(135deg, #6C5CE7, #00B4D8, #00F5A0)",
                backgroundSize: "200% 200%",
                animation: "gradient-shift 4s ease infinite",
              }}
            >
              M
            </div>
            <h1 className="text-[22px] font-semibold text-[rgba(255,255,255,0.85)]">
              欢迎使用 MAGIC
            </h1>
            <p className="mt-1.5 text-[13px] text-[rgba(255,255,255,0.4)]">
              Multi-Agent Governance &amp; Intelligent Collaboration
            </p>
          </div>

          <div
            className="w-[380px] rounded-[14px] border-[0.5px] border-[rgba(255,255,255,0.06)] px-8 py-7"
            style={{
              background: "rgba(18,18,26,0.85)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
            }}
          >
            <h2 className="text-[15px] font-semibold text-[rgba(255,255,255,0.85)]">
              连接 Matrix 服务器
            </h2>
            <p className="mb-5 mt-1 text-xs leading-relaxed text-[rgba(255,255,255,0.4)]">
              输入你的 Matrix homeserver 地址和账号信息，开始多 Agent 协同工作
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[rgba(255,255,255,0.4)]">
                  服务器地址
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
                <label className="mb-1.5 block text-xs font-medium text-[rgba(255,255,255,0.4)]">
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
                <label className="mb-1.5 block text-xs font-medium text-[rgba(255,255,255,0.4)]">
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
                <div className="rounded-lg border-[0.5px] border-[rgba(244,63,94,0.3)] bg-[rgba(244,63,94,0.08)] px-3 py-2 text-sm text-[#F43F5E]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-lg py-2.5 text-sm font-medium text-white
                           transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #6C5CE7, #3B82F6)",
                }}
              >
                {isLoading ? "连接中…" : "连接服务器"}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div
                className="h-px flex-1"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
                }}
              />
              <span className="text-[11px] text-[rgba(255,255,255,0.2)]">或快速连接</span>
              <div
                className="h-px flex-1"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
                }}
              />
            </div>

            <div className="space-y-2">
              {QUICK_SERVERS.map((server) => (
                <button
                  key={server.url}
                  type="button"
                  onClick={() => {
                    setHomeserver(server.url);
                    setError(null);
                  }}
                  disabled={isLoading}
                  className="flex w-full items-center gap-3 rounded-lg border-[0.5px]
                             border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5
                             text-left transition-colors
                             hover:border-[rgba(108,92,231,0.3)] hover:bg-[rgba(255,255,255,0.06)]
                             disabled:opacity-50"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: server.color }}
                  >
                    {server.initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[rgba(255,255,255,0.85)]">
                      {server.name}
                    </p>
                    <p className="truncate text-[11px] text-[rgba(255,255,255,0.2)]">
                      {server.url}
                    </p>
                  </div>
                  <span className="text-sm text-[rgba(255,255,255,0.2)]">→</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-[11px] text-[rgba(255,255,255,0.2)]">
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
