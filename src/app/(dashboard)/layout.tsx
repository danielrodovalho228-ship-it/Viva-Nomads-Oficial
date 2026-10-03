import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AuthGuard } from "@/components/layout/auth-guard";
import { ModeInitializer } from "@/components/layout/mode-initializer";
import { PushRegister } from "@/components/native/push-register";
import { ExpoPushBridge } from "@/components/native/expo-push-bridge";
import { resolveInitialMode } from "@/lib/data/mode-actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Modo inicial resolvido NO SERVIDOR (reteste QA item 1) — preferência do
  // perfil → papel → conta nova. Evita cair em Inquilino por padrão.
  const initialMode = await resolveInitialMode();
  return (
    <AuthGuard>
      <ModeInitializer initialMode={initialMode} />
      <PushRegister />
      <ExpoPushBridge />
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
