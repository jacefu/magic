import { LoginForm } from "./LoginForm.js";

interface LoginPageProps {
  onLogin: (homeserver: string, username: string, password: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
}

export function LoginPage({ onLogin, error, isLoading }: LoginPageProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-magic-surface">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">MAGIC</h1>
          <p className="mt-1 text-sm text-gray-400">
            Multi-Agent Governance &amp; Intelligent Collaboration
          </p>
        </div>

        <LoginForm onSubmit={onLogin} isLoading={isLoading} error={error} />

        <p className="mt-6 text-center text-xs text-gray-500">
          由 Magic 平台提供 · 基于 Matrix 协议
        </p>
      </div>
    </div>
  );
}
