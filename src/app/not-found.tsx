import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { NotFoundIllustration } from "@/components/illustrations";
import { PropertyCard } from "@/components/property-card";
import { listProperties } from "@/lib/data/properties";

export default async function NotFound() {
  // Transforma o erro em retenção: mostra imóveis disponíveis de verdade.
  const featured = (await listProperties()).slice(0, 3);

  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <header className="container-page py-6">
        <Logo href="/home" />
      </header>

      <main className="container-page flex flex-1 flex-col items-center justify-center py-10 text-center">
        <NotFoundIllustration />
        <p className="mt-8 font-title text-6xl font-bold text-ink">404</p>
        <h1 className="mt-2 font-title text-2xl font-bold text-ink">Página não encontrada</h1>
        <p className="mt-2 max-w-md text-muted">
          Não encontramos esta página. Já que você está aqui, veja estes imóveis disponíveis.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/buscar" variant="primary">
            Buscar imóveis
          </ButtonLink>
          <ButtonLink href="/home" variant="outline">
            Ir para o início
          </ButtonLink>
        </div>

        {featured.length > 0 && (
          <section className="mt-14 w-full" aria-label="Imóveis em destaque">
            <h2 className="mb-5 font-title text-lg font-bold text-ink">Imóveis em destaque</h2>
            <div className="grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => (
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          </section>
        )}

        <Link
          href="/para-proprietarios"
          className="mt-12 text-sm text-muted hover:text-blue-500"
        >
          É proprietário? Anuncie seu imóvel →
        </Link>
      </main>
    </div>
  );
}
