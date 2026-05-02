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

  return (
    <DialogOverlay onClose={isLoading ? () => {} : onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-[#313338] p-6 shadow-2xl"
      >
        <h2 className="text-lg font-semibold text-[#DBDEE1]">
          添加 Matrix 服务器
        </h2>
        <p className="mt-1 text-xs text-[#949BA4]">
          登录一个新的 Matrix homeserver，它会作为独立的工作区出现在左侧栏
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-[#949BA4]">
              服务器地址
            </label>
            <input
              type="url"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              placeholder="https://matrix.example.com"
              autoFocus
              disabled={isLoading}
              className="w-full rounded-lg border border-[#3F4147] bg-[#1E1F22]
                         px-3 py-2 text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                         focus:border-[#5865F2] focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[#949BA4]">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@user:example.com 或 user"
              disabled={isLoading}
              autoComplete="username"
              className="w-full rounded-lg border border-[#3F4147] bg-[#1E1F22]
                         px-3 py-2 text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                         focus:border-[#5865F2] focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[#949BA4]">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              disabled={isLoading}
              autoComplete="current-password"
              className="w-full rounded-lg border border-[#3F4147] bg-[#1E1F22]
                         px-3 py-2 text-sm text-[#DBDEE1] placeholder-[#6D6F78]
                         focus:border-[#5865F2] focus:outline-none disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-[#F23F43]">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-lg px-3 py-1.5 text-sm text-[#949BA4]
                         transition-colors hover:text-[#DBDEE1] disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-[#5865F2] px-4 py-1.5 text-sm font-medium text-white
                         transition-colors hover:bg-[#4752C4] disabled:opacity-50"
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
  if (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("ECONNREFUSED")
  ) {
    return "无法连接到服务器，请检查地址";
  }
  return `连接失败: ${msg}`;
}
