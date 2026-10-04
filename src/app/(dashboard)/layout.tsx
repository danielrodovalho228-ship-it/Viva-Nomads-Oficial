import type { Metadata } from "next";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AuthGuard } from "@/components/layout/auth-guard";
import { ModeInitializer } from "@/components/layout/mode-initializer";
import { PushRegister } from "@/components/native/push-register";
import { resolveInitialMode } from "@/lib/data/mode-actions";

// Área logada: nunca no índice de busca (/dashboard/*, /admin, /qualificar…).
export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Viva Nomads" },
  description: "Painel da sua conta Viva Nomads.",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Modo inicial resolvido NO SERVIDOR (reteste QA item 1) — preferência do
  // perfil → papel → conta nova. Evita cair em Inquilino por padrão.
  const initialMode = await resolveInitialMode();
  return (
    <AuthGuard>
      <ModeInitializer initialMode={initialMode} />
      <PushRegister />
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
