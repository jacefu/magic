import { AuthGuard, MainLayout, useAutoAccept, useNotifications } from "@magic/ui";

export default function App() {
  useNotifications();
  useAutoAccept(true);

  return (
    <AuthGuard>
      <MainLayout />
    </AuthGuard>
  );
}
