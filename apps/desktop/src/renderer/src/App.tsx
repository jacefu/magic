import { AuthGuard, MainLayout } from "@magic/ui";

export default function App() {
  return (
    <AuthGuard>
      <MainLayout />
    </AuthGuard>
  );
}
