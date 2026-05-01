import { LoginForm } from "./LoginForm.js";

interface LoginPageProps {
  onLogin: (homeserver: string, username: string, password: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
}

export function LoginPage({ onLogin, error, isLoading }: LoginPageProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-bg-tertiary px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">MAGIC</h1>
          <p className="mt-1 text-sm text-text-muted">
            Multi-Agent Governance &amp; Intelligent Collaboration
          </p>
        </div>

        <div className="rounded-lg bg-bg-secondary p-6 shadow-2xl">
          <LoginForm onSubmit={onLogin} isLoading={isLoading} error={error} />
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          由 Magic 平台提供 · 基于 Matrix 协议
        </p>
      </div>
    </div>
  );
}
