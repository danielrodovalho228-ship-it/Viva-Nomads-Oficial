import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { NotFoundIllustration } from "@/components/illustrations";
import { PropertyCard } from "@/components/property-card";
import { listProperties } from "@/lib/data/properties";

// 404: só o noindex do Next (sem canonical nem o robots da raiz).
export const metadata: Metadata = {
  title: "Página não encontrada",
  // null: não herda o "index, follow" da raiz — fica só o "noindex" que o
  // próprio Next põe na 404 (antes saíam os dois, contraditórios).
  robots: null,
};

export default async function NotFound() {
  // Transforma o erro em retenção: mostra imóveis disponíveis de verdade.
  const featured = (await listProperties()).slice(0, 3);

  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <header className="container-page py-6">
        {/* Varredura 02/11: o logo (32 px) ganha alvo de 44 px no toque. */}
        <Logo href="/" className="alvo-toque" />
      </header>

      <main className="container-page flex flex-1 flex-col items-center justify-center py-12 text-center">
        <NotFoundIllustration />
        <p className="mt-8 font-title text-2xl font-semibold text-ink">404</p>
        <h1 className="mt-2 font-title text-2xl font-semibold text-ink">Página não encontrada</h1>
        <p className="mt-2 max-w-md text-muted">
          Não encontramos esta página. Já que você está aqui, veja estes imóveis disponíveis.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/buscar" variant="primary">
            Buscar imóveis
          </ButtonLink>
          <ButtonLink href="/" variant="outline">
            Ir para o início
          </ButtonLink>
        </div>

        {featured.length > 0 && (
          <section className="mt-12 w-full" aria-label="Imóveis em destaque">
            <h2 className="mb-4 font-title text-lg font-semibold text-ink">Imóveis em destaque</h2>
            {/* Grade par: em 2 colunas (tablet) aparecem 2 destaques — um 3º esticado viraria uma foto enorme; em 1 e 3 colunas, os três. */}
            <div className="grid gap-6 text-left sm:grid-cols-2 sm:max-lg:[&>:nth-child(3)]:hidden lg:grid-cols-3" data-testid="nao-encontrada-destaques">
              {featured.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </section>
        )}

        <Link
          href="/para-proprietarios"
          className="alvo-toque mt-12 text-sm text-muted hover:text-blue-500"
          data-testid="nao-encontrada-anunciar"
        >
          É proprietário? Anuncie seu imóvel →
        </Link>
      </main>
    </div>
  );
}
