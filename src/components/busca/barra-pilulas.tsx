"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Award, CalendarDays, Home, Map as IconeMapa, MapPin, SlidersHorizontal, Wallet } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { OPCOES_PRECO, OPCOES_TIPO, type FiltrosPainel } from "@/lib/busca/painel-filtros";
import { ROTULO_PILULA, valorDaPilula, type IdPilula } from "@/lib/busca/pilulas";
import { facetaUnica } from "@/lib/busca/facetas";
import { NIVEIS, ROTULO_NIVEL, type Nivel } from "@/config/niveis";
import { TEXTO_SEM_NIVEIS, grupoNivel } from "@/lib/busca/filtro-nivel";
import { ROTULO_DATAS_FLEXIVEIS } from "@/lib/busca/datas-flexiveis";
import { cn } from "@/lib/utils";

const ROTULO = ROTULO_PILULA;
const ICONE: Record<IdPilula, React.ComponentType<{ className?: string }>> = { datas: CalendarDays, local: MapPin, tipo: Home, preco: Wallet, nivel: Award, ordenar: ArrowUpDown };

/**
 * E82-A + E91 + E95 (mockup BUSCA-CARD): UMA linha de controles — Datas · Local · Tipo · Preço · Nível · Mais filtros ·
 * Ordenar · Mapa. Pílulas de contorno; a ativa fica preenchida e mostra o valor. Cada pílula abre um painel pequeno logo
 * abaixo da linha (no celular a linha rola de lado). As opções e as contagens são as da folha (FILTROS-B); a escolha vale
 * na hora, pela mesma função da folha. "Mais filtros" abre a folha; "Mapa" alterna lista e mapa.
 */
export function BarraPilulas(p: {
  filtros: FiltrosPainel;
  contar: (f: FiltrosPainel) => number;
  aplicar: (f: FiltrosPainel) => void;
  /** Conteúdo do painel Local (cidade/bairro, "Perto de", meio e tempo) — vem da busca. */
  painelLocal: React.ReactNode;
  local: string;
  perto: string | null;
  /** Moradores (adultos + crianças): o seletor vive no painel Datas. */
  painelMoradores: React.ReactNode;
  nMaisFiltros: number;
  onMaisFiltros: () => void;
  ordem: string;
  opcoesOrdem: [string, string][];
  onOrdem: (v: string) => void;
  mapa: boolean;
  onMapa: () => void;
}) {
  const [aberto, setAberto] = useState<IdPilula | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!alvo.isConnected || caixa.current?.contains(alvo)) return;
      if (alvo instanceof Element && alvo.closest("[data-folha], [role='listbox'], [role='option']")) return;
      setAberto(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(null);
    document.addEventListener("click", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const f = p.filtros;
  const rotuloOrdem = p.opcoesOrdem.find(([v]) => v === p.ordem)?.[1] ?? null;
  const valor = (id: IdPilula) => valorDaPilula(id, f, { local: p.local, perto: p.perto, ordem: p.ordem === "relevance" ? null : rotuloOrdem });
  const alterna = <K extends "maxPrice" | "tipo">(k: K, v: FiltrosPainel[K], vazio: FiltrosPainel[K]) => p.aplicar({ ...f, [k]: f[k] === v ? vazio : v });
  const porNivel = Object.fromEntries(NIVEIS.map((v) => [v, p.contar({ ...f, nivelMin: v })])) as Record<Nivel, number>;
  const nivel = grupoNivel(porNivel, f.nivelMin ?? "");

  const pilula = (id: IdPilula) => {
    const v = valor(id);
    const Icone = ICONE[id];
    return (
      <Chip
        key={id}
        ativo={!!v}
        aria-expanded={aberto === id}
        aria-haspopup="true"
        onClick={() => setAberto((a) => (a === id ? null : id))}
        data-testid={`pilula-${id}`}
        data-valor={v ?? ""}
        className={cn("shrink-0 gap-2 whitespace-nowrap", aberto === id && !v && "border-ink")}
      >
        <Icone className="h-4 w-4" aria-hidden />
        <span className="max-w-[12rem] truncate">{v ?? ROTULO[id]}</span>
      </Chip>
    );
  };
  const opcao = (key: string, ativo: boolean, n: number | null, desabilitado: boolean, onClick: () => void, rotulo: string, testId: string) => (
    <Chip key={key} ativo={ativo} disabled={desabilitado} onClick={onClick} data-testid={testId} data-n={n ?? undefined} className="disabled:cursor-not-allowed disabled:opacity-50">
      {rotulo}
      {n !== null && (
        <span aria-hidden="true" className="tabular-nums opacity-70" data-testid={`${testId}-n`}>
          {" "}
          · {n}
        </span>
      )}
    </Chip>
  );

  return (
    <div ref={caixa} className="relative" data-testid="busca-controles">
      <div role="toolbar" aria-label="Filtros da busca" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" data-testid="linha-pilulas">
        {pilula("datas")}
        {pilula("local")}
        {pilula("tipo")}
        {pilula("preco")}
        {pilula("nivel")}
        <Chip ativo={p.nMaisFiltros > 0} onClick={p.onMaisFiltros} aria-haspopup="dialog" data-testid="pilula-mais" className="shrink-0 gap-2 whitespace-nowrap">
          <SlidersHorizontal className="h-4 w-4" aria-hidden /> Mais filtros
          {p.nMaisFiltros > 0 && <span className="tabular-nums">({p.nMaisFiltros})</span>}
        </Chip>
        {pilula("ordenar")}
        <Chip ativo={p.mapa} onClick={p.onMapa} data-testid="pilula-mapa" className="shrink-0 gap-2 whitespace-nowrap">
          <IconeMapa className="h-4 w-4" aria-hidden /> Mapa
        </Chip>
      </div>

      {aberto && (
        <div className="absolute left-0 right-0 z-40 mt-2 rounded-xl border border-line bg-white p-4 shadow-flutuante sm:right-auto sm:w-[28rem]" data-testid={`painel-pilula-${aberto}`} role="dialog" aria-label={ROTULO[aberto]}>
          {aberto === "datas" && (
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-ink">
                Entrada a partir de
                <input
                  type="date"
                  lang="pt-BR"
                  value={f.entrada}
                  onChange={(e) => p.aplicar({ ...f, entrada: e.target.value, datasFlexiveis: e.target.value ? f.datasFlexiveis : false })}
                  className="mt-2 block h-11 w-full rounded-lg border border-line bg-white px-4 text-sm font-normal text-ink outline-none focus:border-ink"
                  data-testid="pilula-datas-entrada"
                />
              </label>
              {f.entrada && (
                <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="h-5 w-5 accent-forest" checked={f.datasFlexiveis} onChange={(e) => p.aplicar({ ...f, datasFlexiveis: e.target.checked })} data-testid="pilula-datas-flexiveis" />
                  {ROTULO_DATAS_FLEXIVEIS}
                </label>
              )}
              {/* E105: o período da estadia mora só na folha "Mais filtros" (seção Estadia) — um lugar só. */}
              {p.painelMoradores}
            </div>
          )}
          {aberto === "local" && <div className="space-y-4">{p.painelLocal}</div>}
          {aberto === "tipo" && (
            <div className="flex flex-wrap gap-2">
              {OPCOES_TIPO.map((o) => {
                const fc = facetaUnica(p.contar, f, "tipo", o.valor);
                return opcao(o.valor, f.tipo === o.valor, fc.n, fc.desabilitado, () => alterna("tipo", o.valor, ""), o.rotulo, `pilula-tipo-${o.valor}`);
              })}
            </div>
          )}
          {aberto === "preco" && (
            <div className="flex flex-wrap gap-2">
              {OPCOES_PRECO.map((o) => {
                const fc = facetaUnica(p.contar, f, "maxPrice", o.valor);
                return opcao(String(o.valor), f.maxPrice === o.valor, fc.n, fc.desabilitado, () => alterna("maxPrice", o.valor, 0), o.rotulo, `pilula-preco-${o.valor}`);
              })}
            </div>
          )}
          {/* E105: o nível mora só aqui (saiu da folha "Mais filtros"); sem nenhum nível na busca, a mesma frase de antes. */}
          {aberto === "nivel" &&
            (nivel.visivel ? (
              <div className="flex flex-wrap gap-2">
                {NIVEIS.map((v) =>
                  opcao(v, f.nivelMin === v, porNivel[v], nivel.desabilitado[v], () => p.aplicar({ ...f, nivelMin: f.nivelMin === v ? "" : v }), v === "premium" ? ROTULO_NIVEL[v] : `${ROTULO_NIVEL[v]} ou acima`, `pilula-nivel-${v}`),
                )}
              </div>
            ) : (
              <p className="text-sm text-muted" data-testid="painel-nivel-vazio">
                {TEXTO_SEM_NIVEIS}
              </p>
            ))}
          {aberto === "ordenar" && (
            <div className="flex flex-col gap-1" role="radiogroup" aria-label="Ordenar resultados">
              {p.opcoesOrdem.map(([v, r]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={p.ordem === v}
                  onClick={() => {
                    p.onOrdem(v);
                    setAberto(null);
                  }}
                  className={cn("flex min-h-11 items-center rounded-lg px-3 text-left text-sm", p.ordem === v ? "bg-surface-2 font-semibold text-ink" : "text-ink hover:bg-surface-2")}
                  data-testid={`pilula-ordem-${v}`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => setAberto(null)} className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4" data-testid="painel-pilula-fechar">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
