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

  return (
    <div className="flex h-screen bg-[#313338]">
      {/* Empty workspace rail — only the "+" button + vertical hint */}
      <div className="flex w-[72px] shrink-0 flex-col items-center bg-[#1E1F22] pt-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full
                     border-[1.5px] border-dashed border-[#6D6F78] text-lg text-[#6D6F78]"
          aria-label="添加服务器"
        >
          +
        </div>
        <span
          className="mt-3 text-[10px] text-[#6D6F78]"
          style={{ writingMode: "vertical-rl" }}
        >
          添加服务器
        </span>
      </div>

      {/* Centred welcome card */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2] text-[28px] font-semibold text-white">
            M
          </div>
          <h1 className="text-[22px] font-semibold text-[#DBDEE1]">
            欢迎使用 MAGIC
          </h1>
          <p className="mt-1.5 text-[13px] text-[#949BA4]">
            Multi-Agent Governance &amp; Intelligent Collaboration
          </p>
        </div>

        <div className="w-[380px] rounded-xl bg-[#2B2D31] px-8 py-7">
          <h2 className="text-[15px] font-semibold text-[#DBDEE1]">
            连接 Matrix 服务器
          </h2>
          <p className="mb-5 mt-1 text-xs leading-relaxed text-[#949BA4]">
            输入你的 Matrix homeserver 地址和账号信息，开始多 Agent 协同工作
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#949BA4]">
                服务器地址
              </label>
              <input
                type="url"
                value={homeserver}
                onChange={(e) => setHomeserver(e.target.value)}
                placeholder="https://matrix.magic.com"
                autoFocus
                disabled={isLoading}
                className="w-full rounded-md border border-[#3F4147] bg-[#1E1F22] px-3 py-2
                           text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                           focus:border-[#5865F2] focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#949BA4]">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@user:magic.com 或 user"
                disabled={isLoading}
                autoComplete="username"
                className="w-full rounded-md border border-[#3F4147] bg-[#1E1F22] px-3 py-2
                           text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                           focus:border-[#5865F2] focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#949BA4]">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                disabled={isLoading}
                autoComplete="current-password"
                className="w-full rounded-md border border-[#3F4147] bg-[#1E1F22] px-3 py-2
                           text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                           focus:border-[#5865F2] focus:outline-none disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-[#F23F43]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-md bg-[#5865F2] py-2.5 text-sm font-medium text-white
                         transition-colors hover:bg-[#4752C4] disabled:opacity-50"
            >
              {isLoading ? "连接中…" : "连接服务器"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#3F4147]" />
            <span className="text-[11px] text-[#6D6F78]">或快速连接</span>
            <div className="h-px flex-1 bg-[#3F4147]" />
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
                className="flex w-full items-center gap-3 rounded-lg border border-[#3F4147]
                           bg-[#313338] px-3 py-2.5 text-left transition-colors
                           hover:border-[#5865F2] hover:bg-[#35373C] disabled:opacity-50"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: server.color }}
                >
                  {server.initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[#DBDEE1]">
                    {server.name}
                  </p>
                  <p className="truncate text-[11px] text-[#6D6F78]">
                    {server.url}
                  </p>
                </div>
                <span className="text-sm text-[#6D6F78]">→</span>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-[11px] text-[#6D6F78]">
          MAGIC Client v0.0.1 · 基于 Matrix 协议
        </p>
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
  if (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("ECONNREFUSED")
  ) {
    return "无法连接到服务器，请检查地址";
  }
  return `连接失败: ${msg}`;
}
