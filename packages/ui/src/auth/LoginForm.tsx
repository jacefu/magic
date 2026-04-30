import { useState, type FormEvent } from "react";

interface LoginFormProps {
  onSubmit: (homeserver: string, username: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const [homeserver, setHomeserver] = useState("https://matrix.magic.com");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    await onSubmit(homeserver.trim(), username.trim(), password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mb-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          {showAdvanced ? "▾ 隐藏高级设置" : "▸ Homeserver 设置"}
        </button>
        {showAdvanced && (
          <input
            type="url"
            value={homeserver}
            onChange={(e) => setHomeserver(e.target.value)}
            placeholder="https://matrix.magic.com"
            disabled={isLoading}
            className="w-full rounded-lg border border-gray-700 bg-magic-surface-alt
                       px-3 py-2 text-sm text-white placeholder-gray-500
                       focus:border-magic-primary focus:outline-none focus:ring-1
                       focus:ring-magic-primary disabled:opacity-50"
          />
        )}
      </div>

      <div>
        <label htmlFor="username" className="mb-1 block text-sm text-gray-300">
          用户名
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="@user:magic.com 或 user"
          disabled={isLoading}
          autoFocus
          autoComplete="username"
          className="w-full rounded-lg border border-gray-700 bg-magic-surface-alt
                     px-3 py-2.5 text-sm text-white placeholder-gray-500
                     focus:border-magic-primary focus:outline-none focus:ring-1
                     focus:ring-magic-primary disabled:opacity-50"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-gray-300">
          密码
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="输入密码"
          disabled={isLoading}
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-700 bg-magic-surface-alt
                     px-3 py-2.5 text-sm text-white placeholder-gray-500
                     focus:border-magic-primary focus:outline-none focus:ring-1
                     focus:ring-magic-primary disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !username.trim() || !password.trim()}
        className="w-full rounded-lg bg-magic-primary px-4 py-2.5 text-sm font-medium
                   text-white transition-colors hover:bg-blue-600
                   disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <LoadingSpinner />
            登录中…
          </span>
        ) : (
          "登录"
        )}
      </button>
    </form>
  );
}

function LoadingSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
