import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { EscolhaIntencaoEntrada } from "@/components/auth/escolha-intencao";
import { getMinhaIntencao } from "@/lib/data/intencao-actions";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/safe-redirect";

export const metadata = { title: "O que você quer fazer", robots: { index: false, follow: false } };

/**
 * Prompt 49 — intenção como camada, logo depois do 1º código de uma conta nova. Quem já respondeu (ou "Agora não")
 * segue direto para o destino; sem sessão, volta para a entrada.
 */
export default async function IntencaoPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const { redirect: alvo } = await searchParams;
  const destino = safeInternalPath(alvo, "/dashboard");
  const supabase = await createClient();
  const usuario = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (supabase && !usuario) redirect(`/auth?redirect=${encodeURIComponent(destino)}`);
  if ((await getMinhaIntencao()) !== null) redirect(destino);
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Logo href="/" />
        </div>
        <EscolhaIntencaoEntrada destino={destino} />
      </div>
    </div>
  );
}
