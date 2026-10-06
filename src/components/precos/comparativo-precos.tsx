"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALUGUEL_EXEMPLO, GESTOR_PRECO, GESTOR_RESUMO, MERCADO, MESES_EXEMPLO, PLANOS, REGRAS_CONTRATO, textoComissao, reaisInteiros } from "@/config/planos";
import { calcularComparativo, custoAnualPorPlano, planoMaisBarato, textoIndisponivel } from "@/lib/comparativo-precos";
import { GraficoCustoPorImovel } from "./grafico-custo-por-imovel";

/**
 * "Quanto você paga: Viva Nomads × Airbnb" — componente ÚNICO, com números só
 * de config/planos.ts. Versões: "completo" (/precos), "curto"
 * (/para-proprietarios) e a linha do Anunciar (LinhaComparativoAnuncio).
 */

const pct = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString("pt-BR")}%`;

function Rodape() {
  return (
    <p className="mt-4 text-xs text-muted">
      Exemplo ilustrativo. {MERCADO.airbnbFonte} Imobiliária tradicional: média de mercado (1º aluguel + {pct(MERCADO.imobiliariaAdmMensal)} de administração ao mês). Valores de{" "}
      {MERCADO.dataReferencia}.
    </p>
  );
}

function Campo({ rotulo, valor, onChange, min, max, sufixo }: { rotulo: string; valor: number; onChange: (n: number) => void; min: number; max?: number; sufixo?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{rotulo}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={valor || ""}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? Math.min(max ?? Infinity, Math.max(0, n)) : 0);
          }}
          className="w-full rounded-xl border border-sage-200 px-3 py-2.5 text-sm text-ink outline-none focus:border-forest"
        />
        {sufixo && <span className="shrink-0 text-muted">{sufixo}</span>}
      </span>
    </label>
  );
}

export function ComparativoPrecos({ variante = "completo" }: { variante?: "completo" | "curto" }) {
  const [aluguel, setAluguel] = useState(ALUGUEL_EXEMPLO);
  const [meses, setMeses] = useState(MESES_EXEMPLO);
  const c = useMemo(() => calcularComparativo(aluguel, meses), [aluguel, meses]);
  const maisBaratoContrato = c.planos.reduce((a, b) => (b.total < a.total ? b : a), c.planos[0]);

  if (variante === "curto") {
    const gratis = c.planos.find((p) => p.id === "free")!;
    return (
      <div className="rounded-2xl border border-sage-200 bg-white p-5 text-ink">
        <p className="flex items-center gap-2 font-title text-lg font-bold">
          <Scale className="h-5 w-5 text-forest" /> Quanto você paga: Viva Nomads × Airbnb
        </p>
        <p className="mt-2 text-sm text-muted">
          Aluguel de {reaisInteiros(c.aluguel)} por {c.meses} meses ({reaisInteiros(c.valorContrato)} no contrato):
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-sage-100 p-3">
            <p className="text-xs text-muted">Viva Nomads (Gratuito)</p>
            <p className="font-title text-2xl font-bold text-forest">{reaisInteiros(gratis.total)}</p>
            <p className="text-xs text-muted">uma vez</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="text-xs text-muted">Airbnb</p>
            <p className="font-title text-2xl font-bold text-ink">{reaisInteiros(c.airbnb)}</p>
            <p className="text-xs text-muted">{pct(MERCADO.airbnbTaxa)} do período</p>
          </div>
        </div>
        <p className="mt-3 text-sm">
          <Link href="/precos" className="font-medium text-forest underline">
            Ver a comparação completa e qual plano compensa
          </Link>
        </p>
        <Rodape />
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-sage-200 bg-white p-5 shadow-sm sm:p-8">
      <h2 className="flex items-center gap-2 font-title text-2xl font-bold text-ink">
        <Scale className="h-6 w-6 text-forest" /> Quanto você paga: Viva Nomads × Airbnb
      </h2>
      <p className="mt-1 text-sm text-muted">Mude o aluguel e a duração do contrato. Tudo em reais.</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Aluguel mensal" valor={aluguel} onChange={setAluguel} min={0} sufixo="R$/mês" />
        <Campo rotulo="Meses de contrato" valor={meses} onChange={(n) => setMeses(Math.max(1, Math.round(n)))} min={1} max={REGRAS_CONTRATO.prazoMaxMeses} sufixo="meses" />
      </div>
      <p className="mt-2 text-xs text-muted">Valor do contrato: {reaisInteiros(c.valorContrato)}.</p>

      <ul className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <li className="rounded-2xl border border-line bg-surface-2 p-4">
          <p className="text-sm font-semibold text-ink">Airbnb</p>
          <p className="mt-1 font-title text-2xl font-bold text-ink">{reaisInteiros(c.airbnb)}</p>
          <p className="text-xs text-muted">{pct(MERCADO.airbnbTaxa)} de todo o período</p>
        </li>
        <li className="rounded-2xl border border-line bg-surface-2 p-4">
          <p className="text-sm font-semibold text-ink">Imobiliária tradicional</p>
          <p className="mt-1 font-title text-2xl font-bold text-ink">{reaisInteiros(c.imobiliaria)}</p>
          <p className="text-xs text-muted">média de mercado: 1º aluguel + {pct(MERCADO.imobiliariaAdmMensal)} ao mês</p>
        </li>
        {c.planos.map((p) => {
          const destaque = p.id === maisBaratoContrato.id;
          return (
            <li key={p.id} className={cn("rounded-2xl border p-4", destaque ? "border-forest bg-sage-100 ring-1 ring-forest" : "border-sage-200 bg-white")}>
              <p className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
                Viva Nomads · {p.nome}
                {destaque && <span className="rounded-full bg-forest px-2 py-0.5 text-[11px] font-semibold text-white">mais barato</span>}
              </p>
              <p className="mt-1 font-title text-2xl font-bold text-forest">{reaisInteiros(p.total)}</p>
              <p className="text-xs text-muted">
                {reaisInteiros(p.comissao)} de comissão ({textoComissao(PLANOS.find((x) => x.id === p.id)!.comissao).replace(", uma vez por contrato", ", uma vez")})
                {p.mensalidades > 0 ? ` + ${reaisInteiros(p.mensalidades)} de mensalidades` : ""} · {pct(p.pctDoContrato)} do contrato
              </p>
            </li>
          );
        })}
      </ul>

      <QualPlanoCompensa aluguel={aluguel} meses={meses} />
      <Rodape />
    </div>
  );
}

function QualPlanoCompensa({ aluguel, meses }: { aluguel: number; meses: number }) {
  const [imoveis, setImoveis] = useState(1);
  const [locacoes, setLocacoes] = useState(2);
  // Uma comissão por contrato: contratos no ano = locações por imóvel × imóveis.
  const linhas = useMemo(() => custoAnualPorPlano(imoveis, locacoes * imoveis, aluguel), [imoveis, locacoes, aluguel]);
  const melhor = planoMaisBarato(imoveis, locacoes * imoveis, aluguel);
  return (
    <div className="mt-6 rounded-2xl border border-sage-200 p-4">
      <p className="flex items-center gap-2 font-title text-lg font-bold text-ink">
        <Calculator className="h-5 w-5 text-forest" /> Qual plano compensa no ano?
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Imóveis anunciados" valor={imoveis} onChange={(n) => setImoveis(Math.max(1, Math.round(n)))} min={1} max={999} />
        <Campo rotulo="Locações por imóvel no ano" valor={locacoes} onChange={(n) => setLocacoes(Math.round(n))} min={0} max={12} />
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {linhas.map((l) => (
          <li
            key={l.id}
            aria-disabled={!l.disponivel || undefined}
            data-testid={`plano-ano-${l.id}`}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm",
              !l.disponivel
                ? "border-dashed border-line bg-surface-2 text-muted opacity-60"
                : l.id === melhor
                  ? "border-forest bg-sage-100 font-semibold text-forest"
                  : "border-line text-ink"
            )}
          >
            <span className="block">{l.nome}</span>
            <span className="block">
              {!l.disponivel ? textoIndisponivel(l, imoveis) : l.sobConsulta ? "sob consulta" : `${reaisInteiros(l.total ?? 0)}/ano`}
              {l.disponivel && l.id === melhor ? " · mais barato para você" : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Custo no ano = assinatura anual + comissão (uma por contrato, sobre 1 aluguel de {reaisInteiros(aluguel)}) × locações × imóveis. Gestor: {GESTOR_RESUMO}; acima de {GESTOR_PRECO.imoveisInclusos} imóveis,{" "}
        {reaisInteiros(GESTOR_PRECO.porImovelAdicional)}/mês por imóvel adicional.
      </p>
      <div className="mt-5 border-t border-sage-200 pt-4">
        <GraficoCustoPorImovel aluguel={aluguel} meses={meses} locacoes={locacoes} imoveis={imoveis} plano={melhor} />
      </div>
    </div>
  );
}

/** Linha da etapa de preço do Anunciar: "Você paga R$ X uma vez. No Airbnb seriam R$ Y". */
export function LinhaComparativoAnuncio({ aluguel }: { aluguel: number }) {
  if (!(aluguel > 0)) return null;
  const c = calcularComparativo(aluguel, MESES_EXEMPLO);
  const gratis = c.planos.find((p) => p.id === "free")!;
  return (
    <p className="rounded-lg bg-sage-100 px-3 py-2 text-xs text-ink" data-testid="linha-comparativo">
      Num contrato de {MESES_EXEMPLO} meses, você paga <strong>{reaisInteiros(gratis.total)} uma vez</strong> (plano Gratuito). No Airbnb seriam{" "}
      <strong>{reaisInteiros(c.airbnb)}</strong>.{" "}
      <Link href="/precos" className="font-medium text-forest underline">
        Ver planos
      </Link>
    </p>
  );
}
