"use client";

import { createElement, useState } from "react";
import { Briefcase, UtensilsCrossed, Sofa, Building2, ShieldCheck, Check } from "lucide-react";
import type { AmenityCategory, Property } from "@/lib/types";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { LIMITE_PRINCIPAIS, agruparComodidades, comodidadesPrincipais } from "@/lib/anuncio/comodidades";
import { comodidadesQueNaoTem } from "@/lib/anuncio/nao-tem";
import { NOTA_ESTRUTURA_CONDOMINIO, blocosDeComodidades } from "@/lib/anuncio/comodidades-blocos";
import { CLASSE_ICONE_LISTA, TRACO_ICONE_LISTA, iconeDaComodidade } from "@/lib/anuncio/comodidades-icones";

/**
 * E313 (devolução 31/10): o número de itens de uma categoria pode ser ímpar (ex.: "Cozinha" com 5 de verdade) — a grade
 * não inventa item. O último item fica na PRIMEIRA coluna, alinhado à esquerda como os demais; nunca centrado solto
 * (antes ocupava a linha inteira, centrado). Vale na grade completa (por categoria) e na lista-resumo.
 */
const ITEM_DA_GRADE = "flex items-center gap-3 text-sm justify-start";

function ItemComodidade({ item }: { item: string }) {
  return (
    <li className={`${ITEM_DA_GRADE} text-ink`} data-testid="comodidade-item">
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

/** E357: uma categoria da lista agrupada (título com o ícone da categoria + itens com ícone, em grade de 2 colunas). */
function GrupoDeComodidades({ grupo, testid }: { grupo: { category: AmenityCategory; items: string[] }; testid?: string }) {
  const meta = CATEGORY_META[grupo.category];
  const Icon = meta?.icon ?? Check;
  return (
    <div data-testid={testid} data-categoria={grupo.category}>
      <h4 className="flex items-center gap-2 text-sm font-semibold text-forest" data-testid="comodidades-categoria">
        <Icon className="h-4 w-4 text-sage" aria-hidden /> {meta?.label ?? grupo.category}
      </h4>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
        {grupo.items.map((item) => (
          <ItemComodidade key={item} item={item} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Comodidades: as 5 principais na página e "Ver todas as N comodidades", que abre a lista
 * completa agrupada por categoria. Sem comodidade nenhuma, a seção inteira some.
 */
export function AmenitiesGrid({ property }: { property: Property }) {
  const [aberto, setAberto] = useState(false);
  const agrupadas = agruparComodidades(property);
  if (agrupadas.total === 0) return null;
  // E661: dois blocos — o que é do imóvel (dados do dono) × a estrutura do condomínio (informada pelo proprietário).
  const blocos = blocosDeComodidades(agrupadas, property.propertyType);
  const totalImovel = blocos.imovel.reduce((n, g) => n + g.items.length, 0);
  const naoTem = comodidadesQueNaoTem(property);
  // E191 (QA 25/10): com "Tem" × "Não tem" lado a lado, o "Tem" é a lista COMPLETA — a mesma do diálogo de
  // comodidades (antes, só as 6 primeiras: a 7ª, "Vaga de garagem", sumia do resumo). Sem o "Não tem", seguem as 6
  // principais. "Ver todas as N comodidades" continua abrindo a mesma lista, agrupada por categoria.
  const comTemNaoTem = naoTem.length > 0;
  const principais = comTemNaoTem ? blocos.imovel.flatMap((g) => g.items) : comodidadesPrincipais({ ...agrupadas, grupos: blocos.imovel });

  return (
    <>
    <section aria-labelledby="comodidades-title" data-testid="comodidades">
      <h2 id="comodidades-title" className="font-title text-2xl font-semibold text-ink">
        O imóvel e o que está incluso
      </h2>
      <div className={naoTem.length > 0 ? "mt-4 grid gap-6 md:grid-cols-2" : "mt-4"}>
        <div data-testid="comodidades-tem">
          {naoTem.length > 0 && <h3 className="text-sm font-semibold text-forest">Tem</h3>}
          {comTemNaoTem ? (
            // E357: com "Tem" × "Não tem", o "Tem" é a lista completa AGRUPADA por categoria (ícone por item, grade par), como na folha.
            <div className="mt-3 grid gap-6" data-testid="comodidades-principais">
              {blocos.imovel.map((g) => (
                <GrupoDeComodidades key={g.category} grupo={g} />
              ))}
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3" data-testid="comodidades-principais">
              {principais.map((item) => (
                <ItemComodidade key={item} item={item} />
              ))}
            </ul>
          )}
        </div>
        {naoTem.length > 0 && (
          <div data-testid="comodidades-nao-tem" className="rounded-xl bg-surface-2 p-4">
            <h3 className="text-sm font-semibold text-forest">Não tem</h3>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {naoTem.map((item) => (
                <li key={item} className={`${ITEM_DA_GRADE} text-muted`} data-testid="comodidade-nao-tem-item">
                  {createElement(iconeDaComodidade(item), { className: "h-5 w-5 shrink-0 text-muted", strokeWidth: TRACO_ICONE_LISTA, "aria-hidden": true })} {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Precisa de algo da lista? Pergunte ao proprietário antes de pedir.</p>
          </div>
        )}
      </div>
      {totalImovel > LIMITE_PRINCIPAIS && (
        <>
          <button
            type="button"
            onClick={() => setAberto(true)}
            data-testid="comodidades-ver-todas"
            className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-forest px-4 text-sm font-semibold text-forest"
          >
            Ver todas as {totalImovel} comodidades
          </button>
          <BottomSheet open={aberto} onClose={() => setAberto(false)} title="Comodidades">
            <div className="grid gap-6" data-testid="comodidades-lista-completa">
              {blocos.imovel.map((g) => (
                <GrupoDeComodidades key={g.category} grupo={g} />
              ))}
            </div>
          </BottomSheet>
        </>
      )}
    </section>
    {blocos.condominio.length > 0 && (
      <section aria-labelledby="condominio-title" data-testid="estrutura-condominio">
        <h2 id="condominio-title" className="font-title text-2xl font-semibold text-ink">
          Estrutura do condomínio
        </h2>
        <p className="mt-1 text-sm text-muted" data-testid="estrutura-condominio-nota">{NOTA_ESTRUTURA_CONDOMINIO}</p>
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3" data-testid="estrutura-condominio-itens">
          {blocos.condominio.map((item) => (
            <ItemComodidade key={item} item={item} />
          ))}
        </ul>
      </section>
    )}
    </>
  );
}
