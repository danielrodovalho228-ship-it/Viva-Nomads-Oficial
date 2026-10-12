import { Logo } from "@/components/ui/logo";
import { VerificarCodigoForm } from "@/components/seguranca/duas-etapas";
import { safeInternalPath } from "@/lib/safe-redirect";

export const metadata = { title: "Verificar código", robots: { index: false, follow: false } };

/** Segunda etapa do login do admin: código de 6 dígitos do app autenticador. */
export default async function VerificarCodigoPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  const { redirect } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <Logo href="/" />
        <h1 className="mt-8 font-title text-2xl font-bold text-ink">Verificação em duas etapas</h1>
        <p className="mt-2 text-sm text-muted">Digite o código do seu app autenticador para entrar na área da equipe.</p>
        <VerificarCodigoForm destino={safeInternalPath(redirect, "/admin")} />
      </div>
    </div>
  );
}
