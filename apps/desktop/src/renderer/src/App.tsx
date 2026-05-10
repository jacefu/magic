import {
  AuthGuard,
  MainLayout,
  useAutoAccept,
  useNotifications,
  useTheme,
  useWorkspaceMatrixBridge,
} from "@magic/ui";

export default function App() {
  useTheme();
  useNotifications();
  useAutoAccept(true);
  // Spec 022 — bridge between the Electron main-process WorkspaceManager
  // and the Matrix protocol. Mounted at App root so it survives every
  // route/room change.
  useWorkspaceMatrixBridge();

  return (
    <AuthGuard>
      <MainLayout />
    </AuthGuard>
  );
}
