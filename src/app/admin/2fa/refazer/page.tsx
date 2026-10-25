import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { RefazerDuasEtapasForm } from "@/components/seguranca/refazer-2fa";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Refazer verificação em duas etapas", robots: { index: false, follow: false } };

/**
 * Admin sem acesso ao app autenticador (sessão aal1): confirma a senha, recebe um código por e-mail
 * e apaga o PRÓPRIO fator para cadastrar de novo. Fica fora do layout de /admin (que exige aal2);
 * o proxy libera só esta rota em aal1 e o papel admin é conferido aqui e nas ações do servidor.
 */
export default async function RefazerPage() {
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/auth?redirect=%2Fadmin%2F2fa%2Frefazer");
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (perfil?.role !== "admin") notFound();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <Logo href="/" />
        <h1 className="mt-8 font-title text-2xl font-semibold text-ink">Refazer a verificação em duas etapas</h1>
        <p className="mt-2 text-sm text-muted">Confirme sua senha e o código que enviamos ao seu e-mail. Depois você cadastra o app autenticador de novo.</p>
        <RefazerDuasEtapasForm email={data.user.email ?? ""} />
      </div>
    </div>
  );
}
