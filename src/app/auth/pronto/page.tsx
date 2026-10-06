import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { VoltarParaApp } from "@/components/app/voltar-para-app";
import { safeInternalPath } from "@/lib/safe-redirect";

export const metadata = { title: "E-mail confirmado", robots: { index: false } };

/**
 * Fim da confirmação de e-mail NO CELULAR (o link fica sempre no navegador, por
 * segurança). Mostra "Pronto!" e deixa a pessoa voltar para o app ou seguir no site.
 */
export default async function ProntoPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const destino = safeInternalPath(next);
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <Logo href="/" />
        <div className="mx-auto mt-10 grid h-14 w-14 place-items-center rounded-full bg-sage-100">
          <CheckCircle2 className="h-7 w-7 text-forest" />
        </div>
        <h1 className="mt-4 font-title text-2xl font-bold text-ink">Pronto! E-mail confirmado</h1>
        <p className="mt-2 text-sm text-muted">Sua conta está ativa. Se você usa o app, é só voltar para ele e entrar.</p>
        <div className="mt-6 space-y-3">
          <VoltarParaApp />
          <ButtonLink href={destino} variant="outline" className="w-full">
            Continuar no site
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
