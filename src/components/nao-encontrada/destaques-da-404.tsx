"use client";

import { PropertyCard } from "@/components/property-card";
import { SkeletonCartao } from "@/components/ui/skeleton";
import { useProperties } from "@/lib/use-properties";

/**
 * E961 — "Imóveis em destaque" da página 404, no cliente.
 * O Next monta o not-found.tsx da raiz em todo pedido e manda o resultado no HTML de cada página. Com a vitrine no
 * servidor, toda página do site consultava os imóveis e carregava três cartões (com preço) no próprio HTML, inclusive
 * as telas logadas. Aqui a consulta só acontece quando a 404 aparece de verdade.
 * Enquanto busca, mostra três cartões-fantasma na mesma grade (sem salto quando os destaques chegam).
 * `data-estado` (carregando → pronto | vazio): os testes esperam a vitrine assentar antes de medir.
 */
const GRADE = "grid gap-6 text-left sm:grid-cols-2 sm:max-lg:[&>:nth-child(3)]:hidden lg:grid-cols-3";

export function DestaquesDa404() {
  const { properties, loading } = useProperties("/api/properties");
  const destaques = properties.slice(0, 3);
  if (!loading && destaques.length === 0) return <span hidden data-testid="nao-encontrada-vitrine" data-estado="vazio" />;
  return (
    <section className="mt-12 w-full" aria-label="Imóveis em destaque" aria-busy={loading} data-testid="nao-encontrada-vitrine" data-estado={loading ? "carregando" : "pronto"}>
      <h2 className="mb-4 font-title text-lg font-semibold text-ink">Imóveis em destaque</h2>
      {/* Grade par: em 2 colunas (tablet) aparecem 2 destaques — um 3º esticado viraria uma foto enorme; em 1 e 3 colunas, os três. */}
      {loading ? (
        // Esqueleto (decisão do Gerente, ORDEM-DUET-069): três cartões-fantasma na mesma grade, para a página não saltar
        // quando os destaques chegam.
        <div className={GRADE} data-testid="nao-encontrada-esqueleto">
          <SkeletonCartao />
          <SkeletonCartao />
          <SkeletonCartao />
        </div>
      ) : (
        <div className={GRADE} data-testid="nao-encontrada-destaques">
          {destaques.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </section>
  );
}
