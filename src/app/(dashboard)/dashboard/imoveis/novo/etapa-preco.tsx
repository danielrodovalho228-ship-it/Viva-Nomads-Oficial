"use client";

import { CartaoEscolha, Pilula } from "@/components/anuncio/escolha-assistente";
import { useEffect, useState } from "react";
import { BlockCalendar } from "@/components/property/block-calendar";
import { erroJanelaDisponivel } from "@/lib/anuncio/periodo-disponivel";
import { CampoReais } from "@/components/ui/campo-reais";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { FAIXAS, GARANTIAS_CADASTRO } from "@/lib/faixas";
import { SELO_NF_UI } from "@/lib/flags";
import { TAXA_COMISSAO_PADRAO } from "@/lib/cobranca/regra";
import { taxaDoMeuNovoAnuncio } from "@/lib/preco-justo-actions";
import { SimuladorBolso } from "@/components/precos/simulador-bolso";
import { PrecoSugerido } from "@/components/precos/preco-sugerido";
import { BlocoNegociacao } from "@/components/anuncio/blocos-cadastro";
import type { LimitesPrivados, Negociacao } from "@/lib/anuncio/negociacao";
import { cn, formatBRL, hojeBR } from "@/lib/utils";
import { calcularTudoIncluido, parcelasDoMes, type CamposTotalMes } from "@/lib/precos";
import { MESES_EXEMPLO } from "@/config/planos";
import { CampoDataUnico, Erro, Labeled, MarcaSugerido, Toggle } from "./campos";
import type { CampoSugerido } from "./tipos";

/**
 * Etapa 4 — Preço e disponibilidade (prompt 10): valor mensal com o preço sugerido (mediana de imóveis parecidos
 * na região, quando há dados), condomínio, consumo estimado por quartos, "Disponível a partir de/até" com UM
 * seletor de data (Q8/Q9), faixas de prazo, garantias e o bloco "Negociação" (prompt 17, §8).
 */
export function EtapaPreco(p: {
  /** Assistente em 10 passos: "preco" (passo 8: valores, garantias, negociação) ou "disponibilidade" (passo 9: datas,
   *  prazo, calendário e faixas). Sem parte, tudo junto. */
  parte?: "preco" | "disponibilidade";
  /** E44: id do rascunho já salvo — com ele, a grade do calendário (bloquear datas, importar e exportar .ics) aparece. */
  imovelId?: string | null;
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
  // E110: um horizonte só no Passo 8 — o exemplo do texto acompanha os meses do simulador.
  const [mesesExemplo, setMesesExemplo] = useState(MESES_EXEMPLO);
  const condo = Number(p.condoFee) || 0;
  // E139: o Passo 8 inteiro sai da mesma conta (calcularTudoIncluido → contaDoPeriodo) e da mesma taxa (a da faixa do dono).
  const campos = { monthlyPrice: aluguel, condoFee: condo, utilitiesMode: p.utilitiesMode, utilitiesEstimate: p.utilitiesEstimate } as CamposTotalMes;
  const mes = calcularTudoIncluido(campos);
  const [taxa, setTaxa] = useState(TAXA_COMISSAO_PADRAO);
  useEffect(() => {
    let vivo = true;
    taxaDoMeuNovoAnuncio().then((t) => vivo && setTaxa(t)).catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);
  const garantiaOk = Object.values(p.garantias).some(Boolean);
  const vePreco = p.parte !== "disponibilidade";
  const veDisponibilidade = p.parte !== "preco";
  return (
    <div className="space-y-4" data-testid={p.parte === "disponibilidade" ? "etapa-disponibilidade" : "etapa-preco"}>
      {vePreco && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
            <Labeled label="Valor mensal (sem condomínio e contas)" sugerido={p.sugerido("preco")}>
              <CampoReais
                semPrefixo
                value={p.monthlyPrice === "" ? null : Number(p.monthlyPrice)}
                onChange={(v) => {
                  p.setMonthlyPrice(v == null ? "" : String(v));
                  p.tirarSugestao("preco");
                }}
                placeholder="3.200"
                testid="cadastro-preco"
              />
              {p.precoRegiao && (
                <span className="mt-1 block text-xs text-muted" data-testid="preco-regiao">
                  Sugestão para imóveis parecidos na região ({formatBRL(p.precoRegiao.valor)}). Você pode mudar.
                </span>
              )}
              <Erro msg={p.erros.preco} />
            </Labeled>
            <Labeled label="Condomínio (R$/mês)">
              <CampoReais semPrefixo centavos value={p.condoFee === "" ? null : Number(p.condoFee)} onChange={(v) => p.setCondoFee(v == null ? "" : String(v))} placeholder="0" testid="cadastro-condominio" />
              <span className="mt-1 block text-xs text-muted">{condo > 0 ? `${formatBRL(condo)}/mês` : "Deixe 0 se não houver."}</span>
            </Labeled>
          </div>

          <div className="rounded-xl border border-sage-200 p-4">
            <p className="text-sm font-medium text-ink">
              Despesas de consumo (água, luz, gás)
              <MarcaSugerido ativo={p.sugerido("consumo") && p.utilitiesMode === "fixed"} />
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Despesas de consumo">
              {(["fixed", "real"] as const).map((m) => (
                <CartaoEscolha key={m} on={p.utilitiesMode === m} onClick={() => p.setUtilitiesMode(m)} rotulo={m === "fixed" ? "Valor fixo estimado" : "Consumo real"} testid={`consumo-${m}`} />
              ))}
            </div>
            {p.utilitiesMode === "fixed" ? (
              <div className="mt-3">
                <p className="mb-2 text-xs text-muted">
                  Estimativa pelo número de quartos; ajuste pelas suas contas. O morador paga um valor fixo por mês junto do
                  valor mensal; se o consumo real passar cerca de 20% da estimativa, há cláusula de ajuste com comprovante.
                </p>
                <Labeled label="Estimativa (R$/mês)">
                  <CampoReais
                    semPrefixo
                    centavos
                    value={p.utilitiesEstimate || null}
                    onChange={(v) => {
                      p.setUtilitiesEstimate(v ?? 0);
                      p.tirarSugestao("consumo");
                    }}
                    placeholder="200"
                    testid="cadastro-consumo"
                  />
                </Labeled>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">O morador paga água, luz e gás pelo consumo real, pelo valor das faturas.</p>
            )}
          </div>

          {aluguel > 0 && (
            <div className="rounded-xl border border-sage-200 bg-sage-100/50 p-4">
              <p className="text-xs font-semibold text-muted">Prévia — o morador vê no anúncio</p>
              {/* L2-A item 24 e E139: o mesmo cálculo da busca e do cartão (calcularTudoIncluido), com a conta aberta. */}
              <p className="mt-1 font-title text-2xl font-semibold text-forest" data-testid="cadastro-tudo-incluido">
                {formatBRL(mes.total)}
                <span className="text-sm font-normal text-muted">/mês tudo incluído</span>
              </p>
              {mes.temExtras && (
                <p className="mt-1 text-xs text-ink" data-testid="previa-conta">
                  {parcelasDoMes(mes)}
                </p>
              )}
              <p className="mt-2 flex items-start gap-2 text-xs text-muted">
                <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-sage" />
                <span>O morador paga direto a você.</span>
              </p>
            </div>
          )}
          {/* E139/E140/E151: um período só (os meses do simulador) para a taxa e para o comparador; a taxa é explicada
              uma vez, no simulador. */}
          <SimuladorBolso compacto valorMensal={aluguel} mesesIniciais={mesesExemplo} onMeses={setMesesExemplo} campos={campos} taxa={taxa} />
          <PrecoSugerido aluguel={aluguel} meses={mesesExemplo} taxa={taxa} onUsar={(v) => p.setMonthlyPrice(String(v))} onAirbnbMensal={(v) => p.setAirbnbMensal(v ? String(v) : "")} />

        </>
      )}
      {veDisponibilidade && (
        <>
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
            {/* E193: escolha única em cartões (antes, listas suspensas). */}
            <fieldset className="mt-3">
              <legend className="text-sm font-medium text-ink">Duração mínima</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Duração mínima">
                {["30", "60", "90", "180"].map((d) => (
                  <CartaoEscolha key={d} on={p.minPeriod === d} onClick={() => p.setMinPeriod(d)} rotulo={`${d} dias`} testid={`duracao-minima-${d}`} />
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-3">
              <legend className="text-sm font-medium text-ink">Duração máxima</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Duração máxima">
                {["90", "180"].map((d) => (
                  <CartaoEscolha key={d} on={p.maxPeriod === d} onClick={() => p.setMaxPeriod(d)} rotulo={`${d} dias`} testid={`duracao-maxima-${d}`} />
                ))}
              </div>
            </fieldset>
            <span className="mt-2 block text-xs text-muted">Estadias de 30 a 180 dias são o usual.</span>
            {/* E137: a janela de datas precisa caber a duração mínima (aviso já ao escolher, e o Continuar recusa). */}
            {(() => {
              const msg = erroJanelaDisponivel(p.availableFrom, p.availableUntil, p.minPeriod);
              return msg ? (
                <p role="alert" className="mt-2 text-sm font-semibold text-red-700" data-testid="janela-curta">
                  {msg}
                </p>
              ) : null;
            })()}
          </div>

          {/* E44: o calendário do imóvel já no cadastro — a mesma grade do editor (bloquear, importar e exportar .ics). */}
          <div className="rounded-xl border border-sage-200 p-4" data-testid="calendario-etapa">
            <p className="text-sm font-medium text-ink">Calendário</p>
            {p.imovelId ? (
              <div className="mt-3">
                <BlockCalendar propertyId={p.imovelId} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted" data-testid="calendario-etapa-aguardando">
                O calendário aparece assim que o rascunho for salvo (leva alguns segundos).
              </p>
            )}
          </div>

          <div className="rounded-xl border border-sage-200 p-4">
            <p className="text-sm font-medium text-ink">Faixas de prazo aceitas</p>
            <p className="mb-3 text-xs text-muted">Cada faixa tem regras próprias. Marque as que você aceita.</p>
            <div className="space-y-2">
              {FAIXAS.map((f) => (
                <div key={f.key}>
                  <Pilula papel="pressed" on={!!p.faixas[f.key]} onClick={() => p.setFaixas((s) => ({ ...s, [f.key]: !s[f.key] }))}>
                    {`${f.label} · ${f.resumo}`}
                  </Pilula>
                  {p.faixas[f.key] && <p className="ml-1 mt-1 text-xs text-muted">{f.aviso}</p>}
                </div>
              ))}
            </div>
          </div>

        </>
      )}
      {vePreco && (
        <>
          <BlocoNegociacao valor={p.negociacao} onValor={p.setNegociacao} limites={p.limites} onLimites={p.setLimites} valorMensal={aluguel} />

          <Labeled label="Taxa de preparação (R$, única)">
            <CampoReais semPrefixo centavos value={p.prepFee || null} onChange={(v) => p.setPrepFee(v ?? 0)} placeholder="450" />
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
            <p className="mb-2 text-sm font-medium text-ink">Garantias que você aceita</p>
            <p className="mb-2 text-xs text-muted">
              Só preferência de aceite — <strong>não muda o caminho do dinheiro</strong> (a caução em dinheiro vai para uma
              conta poupança, como manda a lei — a plataforma não tem acesso).
            </p>
            <div className="space-y-3">
              {GARANTIAS_CADASTRO.map((g) =>
                g.disabled ? (
                  <div key={g.key} className="inline-flex min-h-11 items-center gap-3 rounded-full border border-sage-200 bg-surface-2 px-4 py-2 opacity-70">
                    <span className="text-sm font-medium text-muted">Aceito {g.label}</span>
                    {g.badge && <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">{g.badge}</span>}
                  </div>
                ) : (
                  <div key={g.key}>
                    <Pilula papel="pressed" on={!!p.garantias[g.key]} onClick={() => p.setGarantias((s) => ({ ...s, [g.key]: !s[g.key] }))}>
                      {`Aceito ${g.label}`}
                    </Pilula>
                    {g.microtext && <p className="ml-1 mt-1 text-xs text-muted">{g.microtext}</p>}
                  </div>
                )
              )}
            </div>
            {!garantiaOk && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
                Escolha ao menos uma garantia: contrato sem garantia deixa você sem cobertura de danos.
              </p>
            )}
            <Erro msg={p.erros.garantia} />
          </div>
        </>
      )}
    </div>
  );
}
