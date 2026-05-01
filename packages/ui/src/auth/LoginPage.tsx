import { LoginForm } from "./LoginForm.js";

interface LoginPageProps {
  onLogin: (homeserver: string, username: string, password: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
}

// Per design-system § 4.5:
//   - Full screen bg #1E1F22 (deepest)
//   - Login card bg #2B2D31, 12px radius
//   - Primary button #5865F2, hover #4752C4
//   - Inputs bg #1E1F22 with #3F4147 border
export function LoginPage({ onLogin, error, isLoading }: LoginPageProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-[#1E1F22] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">MAGIC</h1>
          <p className="mt-1 text-sm text-[#949BA4]">
            Multi-Agent Governance &amp; Intelligent Collaboration
          </p>
        </div>

        <div className="rounded-xl bg-[#2B2D31] p-6 shadow-2xl">
          <LoginForm onSubmit={onLogin} isLoading={isLoading} error={error} />
        </div>

        <p className="mt-6 text-center text-xs text-[#6D6F78]">
          由 Magic 平台提供 · 基于 Matrix 协议
        </p>
      </div>
    </div>
  );
}
