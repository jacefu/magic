import { useState, type FormEvent } from "react";
import { addServer } from "@magic/matrix-client";
import { DialogOverlay } from "../common/DialogOverlay.js";

interface AddServerDialogProps {
  onClose: () => void;
}

export function AddServerDialog({ onClose }: AddServerDialogProps) {
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
      onClose();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Cosmic AI § 7.10 + § 7.11 — glass dialog + brand-button gradient.
  const inputClasses =
    "w-full rounded-lg border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] " +
    "px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] " +
    "transition-colors focus:border-[var(--border-active)] focus:outline-none disabled:opacity-50";

  return (
    <DialogOverlay onClose={isLoading ? () => {} : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[14px] border-[0.5px] border-[var(--border-default)] p-6"
        style={{
          background: "var(--bg-primary)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          animation: "fade-in-up 0.2s ease-out",
        }}
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          添加 Magic 实例
        </h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          登录一个新的 Magic 实例,它会作为独立的工作区出现在左侧栏
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">
              Magic 实例地址
            </label>
            <input
              type="url"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              placeholder="https://matrix.example.com"
              autoFocus
              disabled={isLoading}
              className={inputClasses}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@user:example.com 或 user"
              disabled={isLoading}
              autoComplete="username"
              className={inputClasses}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">密码</label>
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)]
                         transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg px-4 py-1.5 text-sm font-medium text-white
                         transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--gradient-button)" }}
            >
              {isLoading ? "连接中…" : "添加服务器"}
            </button>
          </div>
        </form>
      </div>
    </DialogOverlay>
  );
}

function parseError(err: unknown): string {
  const e = err as { message?: string; httpStatus?: number };
  const msg = e?.message ?? String(err);
  const status = e?.httpStatus;
  if (status === 403 || msg.includes("M_FORBIDDEN")) return "用户名或密码错误";
  if (status === 429 || msg.includes("M_LIMIT_EXCEEDED"))
    return "请求过于频繁，请稍后重试";
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
