import { useEffect, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { LoginPage } from "./LoginPage.js";
import { SyncingScreen } from "./SyncingScreen.js";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { stage, error, initialize, login } = useAuth();

  useEffect(() => {
    initialize();
  }, [initialize]);

  switch (stage) {
    case "initializing":
    case "restoring":
      return (
        <div className="flex h-screen items-center justify-center bg-magic-surface">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-magic-primary border-t-transparent" />
        </div>
      );

    case "unauthenticated":
      return <LoginPage onLogin={login} error={error} isLoading={false} />;

    case "logging_in":
      return <LoginPage onLogin={login} error={error} isLoading={true} />;

    case "syncing":
      return <SyncingScreen />;

    case "authenticated":
      return <>{children}</>;

    case "error":
      return <LoginPage onLogin={login} error={error} isLoading={false} />;

    default:
      return null;
  }
}
