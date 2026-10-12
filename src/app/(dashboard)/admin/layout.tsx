import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { decidirPortaoMfa, mfaAdminObrigatoria, urlAtivar2fa, urlVerificarCodigo } from "@/lib/admin/mfa";

/**
 * Guarda server-side da área de admin (defesa em profundidade do C1).
 *
 * O proxy (Next.js 16) já barra /admin para não-admin, mas validamos de novo
 * aqui no SERVIDOR — se o proxy for contornado, este layout ainda exige sessão +
 * papel admin (lido de `profiles`, fonte confiável). Em modo demonstração
 * (sem Supabase) não há sessão de servidor para checar, então o acesso segue
 * o comportamento de demo; no acesso real, não-admin recebe 404 (a área nem aparece para quem não é da equipe).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") notFound();

    // Verificação em duas etapas (ordem f7817f00): o proxy já barra; aqui de novo no servidor.
    if (mfaAdminObrigatoria()) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const portao = decidirPortaoMfa(aal?.currentLevel, aal?.nextLevel);
      if (portao !== "liberar") {
        const destino = (await headers()).get("x-vn-destino") ?? "/admin";
        redirect(portao === "verificar" ? urlVerificarCodigo(destino) : urlAtivar2fa(destino));
      }
    }
  }
  return <>{children}</>;
}
