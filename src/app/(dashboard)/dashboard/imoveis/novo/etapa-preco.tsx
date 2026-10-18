"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { FAIXAS, GARANTIAS_CADASTRO } from "@/lib/faixas";
import { SELO_NF_UI } from "@/lib/flags";
import { TEXTO_REGRA_CURTO } from "@/lib/cobranca/regra";
import { LinhaComparativoAnuncio } from "@/components/precos/comparativo-precos";
import { SimuladorBolso } from "@/components/precos/simulador-bolso";
import { PrecoSugerido } from "@/components/precos/preco-sugerido";
import { BlocoNegociacao } from "@/components/anuncio/blocos-cadastro";
import type { LimitesPrivados, Negociacao } from "@/lib/anuncio/negociacao";
import { cn, formatBRL, hojeBR } from "@/lib/utils";
import { CampoDataUnico, Erro, Labeled, MarcaSugerido, Toggle } from "./campos";
import type { CampoSugerido } from "./tipos";

/**
 * Etapa 4 — Preço e disponibilidade (prompt 10): valor mensal com o preço sugerido (mediana de imóveis parecidos
 * na região, quando há dados), condomínio, consumo estimado por quartos, "Disponível a partir de/até" com UM
 * seletor de data (Q8/Q9), faixas de prazo, garantias e o bloco "Negociação" (prompt 17, §8).
 */
export function EtapaPreco(p: {
  sugerido: (c: CampoSugerido) => boolean;
  tirarSugestao: (c: CampoSugerido) => void;
  monthlyPrice: string;
  setMonthlyPrice: (v: string) => void;
  precoRegiao: { valor: number; base: "bairro" | "cidade"; n: number } | null;
  setAirbnbMensal: (v: string) => void;
  condoFee: string;
  setCondoFee: (v: string) => void;
  utilitiesMode: "fixed" | "real";
  setUtilitiesMode: (v: "fixed" | "real") => void;
  utilitiesEstimate: number;
  setUtilitiesEstimate: (v: number) => void;
  availableFrom: string;
  setAvailableFrom: (v: string) => void;
  availableUntil: string;
  setAvailableUntil: (v: string) => void;
  minPeriod: string;
  setMinPeriod: (v: string) => void;
  maxPeriod: string;
  setMaxPeriod: (v: string) => void;
  faixas: Record<string, boolean>;
  setFaixas: (fn: (s: Record<string, boolean>) => Record<string, boolean>) => void;
  garantias: Record<string, boolean>;
  setGarantias: (fn: (s: Record<string, boolean>) => Record<string, boolean>) => void;
  prepFee: number;
  setPrepFee: (v: number) => void;
  issuesInvoice: boolean;
  setIssuesInvoice: (fn: (v: boolean) => boolean) => void;
  negociacao: Negociacao;
  setNegociacao: (n: Negociacao) => void;
  limites: LimitesPrivados;
  setLimites: (l: LimitesPrivados) => void;
  erros: Record<string, string>;
}) {
  const aluguel = Number(p.monthlyPrice) || 0;
  const condo = Number(p.condoFee) || 0;
  const consumoFixo = p.utilitiesMode === "fixed" ? p.utilitiesEstimate || 0 : 0;
  const garantiaOk = Object.values(p.garantias).some(Boolean);
  return (
    <div className="space-y-5" data-testid="etapa-preco">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Labeled label="Valor mensal (R$)" sugerido={p.sugerido("preco")}>
          <input
            type="number"
            min={0}
            value={p.monthlyPrice}
            onChange={(e) => {
              p.setMonthlyPrice(e.target.value);
              p.tirarSugestao("preco");
            }}
            className="input"
            placeholder="3200"
            data-testid="cadastro-preco"
          />
          {p.precoRegiao && (
            <span className="mt-1 block text-xs text-muted" data-testid="preco-regiao">
              Sugestão para imóveis parecidos na região ({formatBRL(p.precoRegiao.valor)}). Você pode mudar.
            </span>
          )}
          <Erro msg={p.erros.preco} />
        </Labeled>
        <Labeled label="Condomínio (R$/mês)">
          <input type="number" min={0} value={p.condoFee} onChange={(e) => p.setCondoFee(e.target.value)} className="input" placeholder="0" />
          <span className="mt-1 block text-xs text-muted">{condo > 0 ? `${formatBRL(condo)}/mês` : "Deixe 0 se não houver."}</span>
        </Labeled>
      </div>

      <div className="rounded-xl border border-sage-200 p-4">
        <p className="text-sm font-medium text-ink">
          Despesas de consumo (água, luz, gás)
          <MarcaSugerido ativo={p.sugerido("consumo") && p.utilitiesMode === "fixed"} />
        </p>
        <div className="mt-2 flex gap-2">
          {(["fixed", "real"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => p.setUtilitiesMode(m)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                p.utilitiesMode === m ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage"
              )}
            >
              {m === "fixed" ? "Valor fixo estimado" : "Consumo real"}
            </button>
          ))}
        </div>
        {p.utilitiesMode === "fixed" ? (
          <div className="mt-3">
            <p className="mb-2 text-xs text-muted">
              Estimativa pelo número de quartos; ajuste pelas suas contas. O morador paga um valor fixo por mês junto do
              valor mensal; se o consumo real passar cerca de 20% da estimativa, há cláusula de ajuste com comprovante.
            </p>
            <Labeled label="Estimativa (R$/mês)">
              <input
                type="number"
                min={0}
                value={p.utilitiesEstimate || ""}
                onChange={(e) => {
                  p.setUtilitiesEstimate(Number(e.target.value));
                  p.tirarSugestao("consumo");
                }}
                className="input"
                placeholder="200"
                data-testid="cadastro-consumo"
              />
            </Labeled>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">O morador paga água, luz e gás pelo consumo real, pelo valor das faturas.</p>
        )}
      </div>

      {aluguel > 0 && (
        <div className="rounded-xl border border-sage-200 bg-sage-100/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Prévia — o morador vê</p>
          <p className="mt-1 font-title text-2xl font-bold text-forest">
            {formatBRL(aluguel + condo + consumoFixo)}
            <span className="text-sm font-normal text-muted">/mês tudo incluído</span>
          </p>
          <p className="mt-2 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
            <span>
              <strong className="text-ink">Você recebe o valor mensal direto na sua conta.</strong> {TEXTO_REGRA_CURTO}
            </span>
          </p>
        </div>
      )}
      <LinhaComparativoAnuncio aluguel={aluguel} />
      <SimuladorBolso compacto valorMensal={aluguel} />
      <PrecoSugerido aluguel={aluguel} onUsar={(v) => p.setMonthlyPrice(String(v))} onAirbnbMensal={(v) => p.setAirbnbMensal(v ? String(v) : "")} />

      {/* Q8/Q9: um seletor só (calendário nativo), rótulos curtos, um embaixo do outro no celular; no computador os dois
          campos alinham pela base (o "(opcional)" do segundo não o empurra para baixo). */}
      <div className="rounded-xl border border-sage-200 p-4" data-testid="disponibilidade">
        <p className="text-sm font-medium text-ink">Disponibilidade e prazo</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end [&>*]:min-w-0">
          <Labeled label="Disponível a partir de">
            <CampoDataUnico value={p.availableFrom} onChange={p.setAvailableFrom} ariaLabel="Disponível a partir de" min={hojeBR()} testid="disponivel-de" />
          </Labeled>
          <Labeled label="Disponível até" ajuda="(opcional)">
            <CampoDataUnico value={p.availableUntil} onChange={p.setAvailableUntil} ariaLabel="Disponível até" min={p.availableFrom || hojeBR()} testid="disponivel-ate" />
          </Labeled>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Labeled label="Duração mínima">
            <select value={p.minPeriod} onChange={(e) => p.setMinPeriod(e.target.value)} className="input">
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
              <option value="90">90 dias</option>
              <option value="180">180 dias</option>
            </select>
          </Labeled>
          <Labeled label="Duração máxima">
            <select value={p.maxPeriod} onChange={(e) => p.setMaxPeriod(e.target.value)} className="input">
              <option value="90">90 dias</option>
              <option value="180">180 dias</option>
            </select>
          </Labeled>
        </div>
        <span className="mt-2 block text-xs text-muted">Estadias de 30 a 180 dias são o usual.</span>
      </div>

      <div className="rounded-xl border border-sage-200 p-4">
        <p className="text-sm font-medium text-ink">Faixas de prazo aceitas</p>
        <p className="mb-3 text-xs text-muted">Cada faixa tem regras próprias. Marque as que você aceita.</p>
        <div className="space-y-2">
          {FAIXAS.map((f) => (
            <div key={f.key}>
              <Toggle checked={!!p.faixas[f.key]} onChange={() => p.setFaixas((s) => ({ ...s, [f.key]: !s[f.key] }))} label={`${f.label} · ${f.resumo}`} />
              {p.faixas[f.key] && <p className="ml-1 mt-1 text-xs text-muted">{f.aviso}</p>}
            </div>
          ))}
        </div>
      </div>

      <BlocoNegociacao valor={p.negociacao} onValor={p.setNegociacao} limites={p.limites} onLimites={p.setLimites} valorMensal={aluguel} />

      <Labeled label="Taxa de preparação (R$, única)">
        <input type="number" min={0} value={p.prepFee || ""} onChange={(e) => p.setPrepFee(Number(e.target.value))} className="input" placeholder="450" />
        <span className="mt-1 block text-xs text-muted">Limpeza profunda antes da entrada, cobrada uma única vez.</span>
      </Labeled>

      {SELO_NF_UI && (
        <Toggle
          checked={p.issuesInvoice}
          onChange={() => p.setIssuesInvoice((v) => !v)}
          label="Este imóvel emite Nota Fiscal do valor mensal"
          hint="Decisivo para o público corporativo (reembolso pela empresa)."
        />
      )}

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink">Garantias que você aceita</p>
        <p className="mb-2 text-xs text-muted">
          Só preferência de aceite — <strong>não muda o caminho do dinheiro</strong> (a caução em dinheiro vai para uma
          conta poupança, como manda a lei — a plataforma não tem acesso).
        </p>
        <div className="space-y-3">
          {GARANTIAS_CADASTRO.map((g) =>
            g.disabled ? (
              <div key={g.key} className="flex items-center justify-between gap-3 rounded-xl border border-sage-200 bg-surface-2 px-4 py-3 opacity-70">
                <span className="text-sm font-medium text-muted">Aceito {g.label}</span>
                {g.badge && <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">{g.badge}</span>}
              </div>
            ) : (
              <div key={g.key}>
                <Toggle checked={!!p.garantias[g.key]} onChange={() => p.setGarantias((s) => ({ ...s, [g.key]: !s[g.key] }))} label={`Aceito ${g.label}`} />
                {g.microtext && <p className="ml-1 mt-1 text-xs text-muted">{g.microtext}</p>}
              </div>
            )
          )}
        </div>
        {!garantiaOk && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Escolha ao menos uma garantia: contrato sem garantia deixa você sem cobertura de danos.
          </p>
        )}
        <Erro msg={p.erros.garantia} />
      </div>
    </div>
  );
}
