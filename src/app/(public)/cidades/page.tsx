import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { CITIES } from "@/lib/constants";
import { listPropertiesByCity } from "@/lib/data/properties";
import { isExemplo } from "@/lib/demo-listing";
import { baseDaVitrine } from "@/lib/busca/contagem-vitrine";
import { linhaIndiceCidade } from "@/lib/indice-cidades";
import { ButtonLink } from "@/components/ui/button";

// F9: dados frescos, como a página de cada cidade.
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Cidades com imóveis mobiliados mensais",
  description: "As cidades onde a Viva Nomads já tem imóveis mobiliados para estadias de 30 a 180 dias, com quantos imóveis cada uma tem.",
  alternates: { canonical: "/cidades" },
};

/**
 * E874: o índice de cidades de verdade (antes, /cidades redirecionava para Uberlândia). Cada cidade liberada com a
 * MESMA contagem da página dela (a base da vitrine: com imóvel real, os exemplos saem) e o detalhe reais × exemplo.
 */
export default async function CidadesPage() {
  const linhas = await Promise.all(
    CITIES.map(async (c) => {
      const base = baseDaVitrine(await listPropertiesByCity(c.name), (p) => isExemplo(p.id));
      const exemplos = base.filter((p) => isExemplo(p.id)).length;
      return linhaIndiceCidade(c, base.length - exemplos, exemplos);
    }),
  );
  return (
    <section className="container-page section-y" data-testid="indice-cidades">
      <h1 className="font-title text-2xl font-semibold text-ink md:text-[28px]">Cidades com imóveis mobiliados mensais</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Onde a Viva Nomads já opera, com quantos imóveis cada cidade tem hoje. Estadias de 30 a 180 dias.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="indice-cidades-lista">
        {linhas.map((l) => (
          <li key={l.slug}>
            <Link
              href={`/cidades/${l.slug}`}
              className="flex items-center gap-4 rounded-xl border border-line p-4 hover:border-ink"
              data-testid="indice-cidade"
              data-cidade={l.slug}
              data-total={l.total}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink" aria-hidden>
                <MapPin className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">
                  {l.nome} – {l.uf}
                </span>
                <span className="block text-sm tabular-nums text-muted" data-testid="indice-cidade-total">
                  {l.rotulo}
                </span>
                {l.detalhe && <span className="block text-sm text-muted">{l.detalhe}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8 max-w-2xl rounded-xl border border-line bg-white p-6" data-testid="indice-cidades-outra">
        <h2 className="font-title text-lg font-semibold text-ink">Sua cidade ainda não está aqui?</h2>
        <p className="mt-2 text-sm text-muted">Publique um pedido de moradia: ele fica registrado e ajuda a Viva a escolher as próximas cidades.</p>
        <ButtonLink href="/pedidos/novo" className="mt-4">
          Publicar pedido de moradia
        </ButtonLink>
      </div>
    </section>
  );
}
