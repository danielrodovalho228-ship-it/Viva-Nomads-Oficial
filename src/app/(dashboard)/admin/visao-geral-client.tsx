"use client";

import { useState } from "react";
import Link from "next/link";
import { FiltrosAdmin } from "@/components/admin/filtros";
import { AvisoAdmin } from "@/components/admin/numeros";
import { Button } from "@/components/ui/button";
import { Download, Info, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BLOCOS,
  FUNIL,
  csvVisaoGeral,
  fmtInteiro,
  fmtPct,
  diasAteHoje,
  formatar,
  funil,
  rotuloPeriodo,
  variacao,
  type FiltroHome,
  type Indicador,
  type Metricas,
  type Periodo,
} from "@/lib/admin/visao-geral";
import { JANELA_AGORA, janelaDias } from "@/lib/admin/indicadores";

/** ADMIN-4: blocos que moram em "Funil e indicadores" (Receita → Financeiro; Operação → Central de Pendências). */
export const BLOCOS_DO_FUNIL: readonly string[] = ["crescimento", "oferta", "demanda", "liquidez"];
import { horaBRT, ETIQUETA_BRASILIA } from "@/lib/datas-brasilia";
import type { VisaoGeral } from "@/lib/data/admin-visao-geral";

/**
 * Números da plataforma no início do /admin (Prompt 46): um número-herói, "Agora" e os blocos do período em listas com
 * divisor fino, e o funil. As decisões ("Hoje você tem N decisões") ficam acima, na página. Todo número é link para a
 * lista que ele conta (regra de 13/10).
 */
export function VisaoGeralClient({
  dados,
  aviso,
  periodo,
  cidade,
  cidades,
  base = "/admin/funil",
}: {
  dados: VisaoGeral | null;
  aviso: string | null;
  periodo: Periodo;
  cidade: string | null;
  cidades: string[];
  /** ADMIN-4: a página que mostra os indicadores (os filtros voltam para ela). */
  base?: string;
}) {
  const filtro: FiltroHome = { inicio: periodo.inicio, fim: periodo.fim, cidade };
  const atual: Metricas = dados?.atual ?? {};
  const anterior: Metricas = dados?.anterior ?? {};

  function baixarCsv() {
    const blob = new Blob(["﻿" + csvVisaoGeral(atual, anterior, periodo, cidade)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-visao-geral-${periodo.inicio}-a-${periodo.fim}${cidade ? "-" + cidade.toLowerCase().replace(/\s+/g, "-") : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ADMIN-4: os números "Agora" moram na inicial do /admin (contagens.ts); aqui ficam os indicadores do período.
  // A Receita mora só no Financeiro e a Operação na Central de Pendências.
  const blocos = BLOCOS.filter((b) => BLOCOS_DO_FUNIL.includes(b.id));

  return (
    <>
      {aviso && <AvisoAdmin className="mb-6">{aviso}</AvisoAdmin>}

      <FiltrosAdmin base={base} periodo={periodo} cidade={cidade} cidades={cidades} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {rotuloPeriodo(periodo.inicio, periodo.fim)} ({periodo.dias} {periodo.dias === 1 ? "dia" : "dias"})
          {dados ? ` · comparado a ${rotuloPeriodo(dados.periodo.inicio_anterior, dados.periodo.fim_anterior)}` : ""}
          {cidade ? ` · ${cidade}` : ""}
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={baixarCsv} disabled={!dados}>
          <Download className="h-4 w-4" aria-hidden /> Baixar CSV
        </Button>
      </div>

      <div className="grid gap-8">
        {blocos.map((b) => (
          <section key={b.id} aria-labelledby={`bloco-${b.id}`}>
            <h2 id={`bloco-${b.id}`} className="mb-2 font-title text-lg font-semibold text-ink">
              {b.titulo}
            </h2>
            <ul className="divide-y divide-line border-y border-line">
              {b.indicadores.map((ind) => (
                <LinhaIndicador key={ind.chave} ind={ind} atual={atual} anterior={anterior} filtro={filtro} />
              ))}
            </ul>
          </section>
        ))}

        <section aria-labelledby="funil-titulo">
          <h2 id="funil-titulo" className="mb-2 font-title text-lg font-semibold text-ink">
            Funil do período
          </h2>
          <FunilPeriodo m={atual} filtro={filtro} />
        </section>
      </div>

      {dados && (
        <p className="mt-6 text-xs text-muted">
          Atualizado às {horaBRT(dados.geradoEm)} ({ETIQUETA_BRASILIA}). Os números ficam guardados por até 5 minutos.
        </p>
      )}
    </>
  );
}

// ── Linha de indicador: rótulo, valor (link), variação e o "i" ───────────────
function LinhaIndicador({ ind, atual, anterior, filtro }: { ind: Indicador; atual: Metricas; anterior: Metricas; filtro: FiltroHome }) {
  const [aberto, setAberto] = useState(false);
  const a = ind.calc(atual);
  const p = ind.calc(anterior);
  const vari = variacao(a, p);
  const bom = vari.direcao === "igual" || vari.direcao === null ? null : (vari.direcao === "sobe") !== !!ind.menorMelhor;
  const Icone = vari.direcao === "sobe" ? TrendingUp : vari.direcao === "desce" ? TrendingDown : Minus;
  const idFormula = `formula-${ind.chave}`;
  const janela = ind.janela === "agora" ? JANELA_AGORA : ind.janela === "dias" ? janelaDias(diasAteHoje(filtro)) : rotuloPeriodo(filtro.inicio, filtro.fim);
  const href = ind.href?.(filtro) ?? null;

  return (
    <li className="py-3" data-indicador={ind.chave}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="flex items-center gap-1 text-sm text-ink">
            {ind.rotulo}
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              aria-controls={idFormula}
              aria-label={`Como é calculado: ${ind.rotulo}`}
              className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:text-forest"
            >
              <Info className="h-4 w-4" />
            </button>
          </span>
          <span className="block text-xs text-muted" data-janela>
            {janela}
            {a === null ? " · sem dados no período" : ""}
          </span>
          <span className={cn("mt-1 flex items-center gap-1 text-xs", bom === null ? "text-muted" : bom ? "text-forest" : "text-red-700")}>
            {ind.janela ? (
              <span>janela própria: sem comparação</span>
            ) : vari.texto === "—" ? (
              <span>sem comparação com o período anterior</span>
            ) : (
              <>
                <Icone className="h-4 w-4" aria-hidden />
                <span>
                  {vari.texto}
                  <span className="text-muted"> vs. anterior ({formatar(p, ind.formato)})</span>
                </span>
              </>
            )}
          </span>
          {ind.nota && <span className="mt-1 block text-xs text-muted">{ind.nota}</span>}
        </div>
        {href ? (
          <Link href={href} className="shrink-0 font-semibold text-ink tabular-nums underline-offset-4 hover:text-forest hover:underline" data-valor data-href={href}>
            {formatar(a, ind.formato)}
          </Link>
        ) : (
          <span className="shrink-0 font-semibold text-ink tabular-nums" data-valor>
            {formatar(a, ind.formato)}
          </span>
        )}
      </div>
      {aberto && (
        <p id={idFormula} className="mt-2 rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink">
          {ind.formula}
        </p>
      )}
    </li>
  );
}

// ── Funil: cada etapa é uma linha com o número (link para a lista da etapa) e o % sobre a anterior ─────────────
function FunilPeriodo({ m, filtro }: { m: Metricas; filtro: FiltroHome }) {
  const etapas = funil(m);
  return (
    <>
      <p className="mb-2 text-xs text-muted">
        Da busca ao contrato. O % é sobre a etapa anterior; etapa anterior zerada mostra &quot;—&quot;. Buscas, anúncios vistos e
        início de candidatura vêm dos eventos anônimos de uso.
      </p>
      {/* Cada etapa abre a lista da etapa, no mesmo período (complemento do P29, item 4). */}
      <ul className="divide-y divide-line border-y border-line" data-testid="funil-links">
        {FUNIL.map((e, i) => (
          <li key={e.rotulo} className="flex items-baseline justify-between gap-4 py-3">
            <span className="min-w-0 text-sm text-ink">
              {e.rotulo}
              {i > 0 && <span className="text-muted"> · {fmtPct(etapas[i]?.daAnterior ?? null)} da anterior</span>}
            </span>
            <Link
              href={e.href(filtro)}
              className="shrink-0 font-semibold text-ink tabular-nums underline-offset-4 hover:text-forest hover:underline"
              data-funil={e.rotulo}
              data-href={e.href(filtro)}
            >
              <span data-valor>{fmtInteiro(e.calc(m))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
