import {
  AuthGuard,
  MainLayout,
  useAutoAccept,
  useNotifications,
  useTheme,
} from "@magic/ui";

export default function App() {
  useTheme();
  useNotifications();
  useAutoAccept(true);

  return (
    <AuthGuard>
      <MainLayout />
    </AuthGuard>
  );
}
