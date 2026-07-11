import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { sanitizeNext } from "@/lib/socios/access";
import { entrarSocios } from "./actions";

export const metadata: Metadata = {
  title: "Área dos sócios",
  robots: { index: false, follow: false },
};

/** Tela de desbloqueio das páginas internas dos sócios (minimalista, marca). */
export default async function AcessoSociosPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const next = sanitizeNext(sp.next);
  const erro = sp.erro === "1";

  return (
    <main className="grid min-h-screen place-items-center bg-surface-2 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-sage-200 bg-white p-8 shadow-lg">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="mt-6 flex flex-col items-center text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-forest/10 text-forest">
            <Lock className="h-6 w-6" />
          </span>
          <h1 className="mt-3 font-title text-xl font-bold text-ink">Área dos sócios</h1>
          <p className="mt-1 text-sm text-muted">
            Conteúdo interno. Informe o código de acesso para continuar.
          </p>
        </div>

        <form action={entrarSocios} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink">Código de acesso</span>
            <input
              type="password"
              name="codigo"
              required
              autoFocus
              autoComplete="off"
              placeholder="••••••••"
              className="w-full rounded-xl border border-sage-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sage"
            />
          </label>

          {erro && (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
              Não foi possível liberar o acesso. Confira o código e tente novamente.
            </p>
          )}

          <Button type="submit" variant="primary" className="w-full justify-center">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}
