"use client";

import { createElement, useState } from "react";
import { Briefcase, UtensilsCrossed, Sofa, Building2, ShieldCheck, Check } from "lucide-react";
import type { AmenityCategory, Property } from "@/lib/types";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { agruparComodidades, comodidadesPrincipais } from "@/lib/anuncio/comodidades";
import { CLASSE_ICONE_LISTA, TRACO_ICONE_LISTA, iconeDaComodidade } from "@/lib/anuncio/comodidades-icones";

function ItemComodidade({ item }: { item: string }) {
  return (
    <li className="flex items-center gap-3 text-sm text-ink" data-testid="comodidade-item">
      {createElement(iconeDaComodidade(item), { className: CLASSE_ICONE_LISTA, strokeWidth: TRACO_ICONE_LISTA, "aria-hidden": true })} {item}
    </li>
  );
}

const CATEGORY_META: Record<AmenityCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  trabalho: { label: "Trabalho", icon: Briefcase },
  cozinha: { label: "Cozinha", icon: UtensilsCrossed },
  conforto: { label: "Conforto", icon: Sofa },
  edificio: { label: "Edifício", icon: Building2 },
  seguranca: { label: "Segurança", icon: ShieldCheck },
};

/**
 * Comodidades: as 5 principais na página e "Ver todas as N comodidades", que abre a lista
 * completa agrupada por categoria. Sem comodidade nenhuma, a seção inteira some.
 */
export function AmenitiesGrid({ property }: { property: Property }) {
  const [aberto, setAberto] = useState(false);
  const agrupadas = agruparComodidades(property);
  if (agrupadas.total === 0) return null;
  const principais = comodidadesPrincipais(agrupadas);

  return (
    <section aria-labelledby="comodidades-title" data-testid="comodidades">
      <h2 id="comodidades-title" className="font-title text-2xl font-bold text-ink">
        Comodidades
      </h2>
      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3" data-testid="comodidades-principais">
        {principais.map((item) => (
          <ItemComodidade key={item} item={item} />
        ))}
      </ul>
      {agrupadas.precisaVerTodas && (
        <>
          <button
            type="button"
            onClick={() => setAberto(true)}
            data-testid="comodidades-ver-todas"
            className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-forest px-4 text-sm font-semibold text-forest"
          >
            Ver todas as {agrupadas.total} comodidades
          </button>
          <BottomSheet open={aberto} onClose={() => setAberto(false)} title="Comodidades">
            <div className="grid gap-6" data-testid="comodidades-lista-completa">
              {agrupadas.grupos.map((g) => {
                const meta = CATEGORY_META[g.category];
                const Icon = meta?.icon ?? Check;
                return (
                  <div key={g.category}>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-forest">
                      <Icon className="h-4 w-4 text-sage" aria-hidden /> {meta?.label ?? g.category}
                    </h3>
                    <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                      {g.items.map((item) => (
                        <ItemComodidade key={item} item={item} />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </BottomSheet>
        </>
      )}
    </section>
  );
}
