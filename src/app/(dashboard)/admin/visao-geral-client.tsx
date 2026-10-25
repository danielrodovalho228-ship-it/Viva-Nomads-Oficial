"use client";

import { useState } from "react";
import Link from "next/link";
import { FiltrosAdmin } from "@/components/admin/filtros";
import { AvisoAdmin, ListaNumeros, NumeroHeroi, type ItemNumero } from "@/components/admin/numeros";
import { Button } from "@/components/ui/button";
import { Download, Info, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { hrefUsuarios } from "@/lib/admin/usuarios-lista";
import {
  BLOCOS,
  FUNIL,
  csvVisaoGeral,
  fmtInteiro,
  fmtPct,
  fmtReais,
  diasAteHoje,
  formatar,
  funil,
  mrr,
  num,
  rotuloPeriodo,
  variacao,
  type FiltroHome,
  type Indicador,
  type Metricas,
  type Periodo,
} from "@/lib/admin/visao-geral";
import { JANELA_AGORA, janelaDias } from "@/lib/admin/indicadores";
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
  demonstracao,
}: {
  dados: VisaoGeral | null;
  aviso: string | null;
  periodo: Periodo;
  cidade: string | null;
  cidades: string[];
  /** Anúncios de exemplo: quantos existem e se aparecem na busca pública agora. */
  demonstracao: { total: number; publicos: boolean };
}) {
  const filtro: FiltroHome = { inicio: periodo.inicio, fim: periodo.fim, cidade };
  // Os cartões "Agora" que têm cidade levam o mesmo filtro para a lista (Prompt 29: número = lista).
  const comCidade = (href: string) => (cidade ? `${href}&cidade=${encodeURIComponent(cidade)}` : href);
  const atual: Metricas = dados?.atual ?? {};
  const anterior: Metricas = dados?.anterior ?? {};
  const agora: Metricas = dados?.agora ?? {};
  const receita = mrr((dados?.agora?.assinaturas as Record<string, unknown> | null | undefined) ?? null);

  function baixarCsv() {
    const blob = new Blob(["﻿" + csvVisaoGeral(atual, anterior, periodo, cidade)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-visao-geral-${periodo.inicio}-a-${periodo.fim}${cidade ? "-" + cidade.toLowerCase().replace(/\s+/g, "-") : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Prompt 46: UM número-herói (o que a plataforma tem no ar agora); o resto em lista com divisor fino.
  const heroi = { rotulo: "Imóveis reais publicados agora", valor: fmtInteiro(num(agora.imoveis_ativos)), href: comCidade("/admin/imoveis?tipo=real&status=active") };
  const agoraItens: ItemNumero[] = [
    { rotulo: "Usuários", valor: fmtInteiro(num(agora.usuarios)), href: hrefUsuarios({}) },
    { rotulo: `Demonstração (${demonstracao.publicos ? "aparecem na busca" : "escondidos"})`, valor: demonstracao.total, href: "/admin/imoveis?tipo=demonstracao" },
    { rotulo: "Anúncios de teste (fora da busca)", valor: fmtInteiro(num(agora.x_imoveis_teste)), href: comCidade("/admin/imoveis?tipo=teste") },
    { rotulo: "Rascunhos", valor: fmtInteiro(num(agora.rascunhos)), href: comCidade("/admin/imoveis?tipo=real&status=draft") },
    { rotulo: "Donos com anúncio", valor: fmtInteiro(num(agora.proprietarios_com_anuncio)), href: hrefUsuarios({ comAnuncio: true }) },
    { rotulo: "Pedidos ativos", valor: fmtInteiro(num(agora.pedidos_ativos)), href: comCidade("/admin/pedidos?status=ativo") },
    { rotulo: "MRR", valor: fmtReais(receita.valor), href: "/admin/financeiro" },
    { rotulo: "Fundadores", valor: fmtInteiro(num(agora.fundadores)), href: hrefUsuarios({ fundador: true }) },
    { rotulo: "Atendimento: chamados abertos", valor: fmtInteiro(num(atual.x_atd_abertos_agora)), href: "/admin/atendimento?aba=fila" },
  ].map((i) => ({ ...i, atributos: { "data-agora": i.rotulo } }));

  return (
    <>
      {aviso && <AvisoAdmin className="mb-6">{aviso}</AvisoAdmin>}

      <NumeroHeroi rotulo={heroi.rotulo} valor={heroi.valor} href={heroi.href} testId="admin-heroi" />

      <section aria-labelledby="agora-titulo" className="mb-8">
        <h2 id="agora-titulo" className="mb-2 font-title text-lg font-semibold text-ink">
          Agora
        </h2>
        <ListaNumeros itens={agoraItens} testId="home-agora" />
        <p className="mt-2 text-xs text-muted">
          MRR = assinaturas ativas × preço mensal do plano ({fmtInteiro(receita.ativas)} ativas
          {receita.semPreco > 0 ? `; ${receita.semPreco} no Gestor, sob consulta, fora do valor` : ""}).
          {cidade ? " Usuários, MRR e Fundadores não têm cidade: com filtro, aparecem como \"—\"." : ""}
        </p>
      </section>

      <FiltrosAdmin base="/admin" periodo={periodo} cidade={cidade} cidades={cidades} />

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
        {BLOCOS.map((b) => (
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
