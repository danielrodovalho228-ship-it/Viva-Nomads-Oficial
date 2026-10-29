import { Check } from "lucide-react";
import { PONTOS_REFERENCIA } from "@/config/pontos-referencia";
import { TIPO_PONTO_SELO } from "@/config/pontos-selos-estrutura";
import { CITIES } from "@/lib/constants";
import { NOTA_ESTRUTURA_INFORMADA, estruturaInformada, pontosDaCidade, rotuloSeloEstrutura, selosDoAnuncio, type ChecklistEstrutura } from "@/lib/selos-estrutura";
import type { Property } from "@/lib/types";

/**
 * E225-A — "Estrutura informada pelo proprietário": SÓ os itens marcados como sim, em texto, sem selo, com a nota
 * "Informado pelo proprietário. Confirme na visita." Nada marcado = nada aparece.
 * Selo de estrutura só com prova (Acessível / Mobilidade reduzida: prova aprovada de cada item — E225-B; Perto de
 * hospital/universidade: só com a lista de pontos da cidade). Hoje nenhum imóvel tem prova nem cidade tem lista.
 */
export function EstruturaInformada({ property, checklist }: { property: Pick<Property, "city" | "state" | "lat" | "lng">; checklist: ChecklistEstrutura | null }) {
  const grupos = estruturaInformada(checklist);
  const selos = selosDoAnuncio({
    checklist,
    provas: [],
    local: { lat: property.lat, lng: property.lng },
    pontosDaCidade: pontosDaCidade(CITIES.find((c) => c.name === property.city)?.slug, PONTOS_REFERENCIA, TIPO_PONTO_SELO),
  });
  if (grupos.length === 0 && selos.length === 0) return null;
  return (
    <section aria-labelledby="estrutura-title" data-testid="estrutura-informada">
      {selos.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2" data-testid="estrutura-selos">
          {selos.map((id) => (
            <li key={id} className="rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-forest">
              {rotuloSeloEstrutura(id)}
            </li>
          ))}
        </ul>
      )}
      {grupos.length > 0 && (
        <>
          <h2 id="estrutura-title" className="font-title text-2xl font-semibold text-ink">
            Estrutura informada pelo proprietário
          </h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {grupos.map((g) => (
              <div key={g.titulo}>
                <h3 className="text-sm font-semibold text-ink">{g.titulo}</h3>
                <ul className="mt-2 space-y-2">
                  {g.itens.map((i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink" data-testid="estrutura-item">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-forest" aria-hidden />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted" data-testid="estrutura-nota">
            {NOTA_ESTRUTURA_INFORMADA}
          </p>
        </>
      )}
    </section>
  );
}
