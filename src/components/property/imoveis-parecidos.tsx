import type { Property } from "@/lib/types";
import { PropertyCard } from "@/components/property-card";

/**
 * "Imóveis parecidos" na página do imóvel (Prompt 40): o MESMO cartão da busca,
 * da home, dos favoritos e das cidades, em grade par (2 no celular, 4 no computador).
 */
export function ImoveisParecidos({ imoveis }: { imoveis: Property[] }) {
  if (imoveis.length === 0) return null;
  return (
    <section className="mt-16" data-testid="imoveis-parecidos" aria-labelledby="imoveis-parecidos-titulo">
      <h2 id="imoveis-parecidos-titulo" className="font-title text-2xl font-semibold text-ink">
        Imóveis parecidos
      </h2>
      <div className="mt-6 grid auto-rows-fr grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-4">
        {imoveis.map((p) => (
          <PropertyCard key={p.id} property={p} />
        ))}
      </div>
    </section>
  );
}
