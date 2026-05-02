import { AuthGuard, MainLayout, useNotifications } from "@magic/ui";

export default function App() {
  useNotifications();

  return (
    <AuthGuard>
      <MainLayout />
    </AuthGuard>
  );
}
