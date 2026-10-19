"use client";

import { CampoReais } from "@/components/ui/campo-reais";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { CampoData } from "@/components/ui/campo-data";
import { enviarProposta, type DadosMontagem } from "@/lib/data/propostas-actions";
import { calcularTotais, MOTIVOS_DESCONTO, VALIDADES_DIAS, validarTermos, type TermosProposta } from "@/lib/propostas/regras";
import { descontoParaMeses } from "@/lib/anuncio/negociacao";
import { textoTaxaPainel } from "@/lib/cobranca/regra";
import { CAUCAO_FRASE } from "@/lib/faixas";
import { formatBRL, hojeBR } from "@/lib/utils";

function Campo({ rotulo, ajuda, children }: { rotulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-medium text-ink">{rotulo}</span>
      {children}
      {ajuda && <span className="mt-1 block text-[13px] text-muted">{ajuda}</span>}
    </label>
  );
}

/** Percentual do desconto (não é dinheiro): "6,5" → 6,5. Valores em R$ usam o CampoReais (lerReais). */
const numero = (v: string) => (v === "" ? 0 : Math.max(0, Number(v.replace(",", ".")) || 0));

/**
 * Montagem da proposta (prompt 17): valores do anúncio já preenchidos e editáveis, desconto opcional (R$ ou %),
 * validade, total por mês e total do contrato na hora — a mesma conta que o servidor refaz ao gravar. A taxa de
 * serviço aparece só aqui (para o proprietário), nunca para o interessado.
 */
export function MontagemProposta({ dados }: { dados: DadosMontagem }) {
  const router = useRouter();
  const [t, setT] = useState<TermosProposta>(dados.termos);
  const [tipoDesconto, setTipoDesconto] = useState<"pct" | "valor">("pct");
  const [pessoas, setPessoas] = useState<string>("");
  const [validade, setValidade] = useState<number>(7);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const termos: TermosProposta = { ...t, descontoEstadiaPct: descontoParaMeses(dados.negociacao.descontos, t.meses) };
  const tot = calcularTotais(termos);
  const pessoasN = pessoas ? Number(pessoas) : null;
  const problema = validarTermos(termos, dados.limites, hojeBR(), pessoasN);
  const set = <K extends keyof TermosProposta>(k: K, v: TermosProposta[K]) => setT((x) => ({ ...x, [k]: v }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (problema) return setErro(problema);
    setEnviando(true);
    const r = await enviarProposta({
      leadId: dados.leadId,
      valorBase: termos.valorBase,
      descontoPct: tipoDesconto === "pct" ? termos.descontoPct : 0,
      descontoValor: tipoDesconto === "valor" ? termos.descontoValor : 0,
      motivoDesconto: termos.descontoPct > 0 || termos.descontoValor > 0 ? termos.motivoDesconto : null,
      meses: termos.meses,
      dataEntrada: termos.dataEntrada,
      condominio: termos.condominio,
      consumo: termos.consumo,
      limpezasMes: termos.limpezasMes,
      valorLimpeza: termos.valorLimpeza,
      taxaPet: termos.taxaPet,
      limpezaUnica: termos.limpezaUnica,
      pessoas: pessoasN,
      validadeDias: validade,
      mensagem: mensagem || undefined,
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.error);
    router.push(`/dashboard/propostas/${r.id}`);
  }

  const meses = Array.from({ length: dados.limites.mesesMax - dados.limites.mesesMin + 1 }, (_, i) => dados.limites.mesesMin + i);

  return (
    <>
      <PageTitle title="Nova proposta" subtitle={`Para ${dados.interessado} · ${dados.imovel.titulo}`} />
      <form onSubmit={enviar} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" data-testid="montagem-proposta">
        <div className="space-y-5">
          <Panel title="Valores">
            <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
              <Campo rotulo="Valor mensal (R$)">
                <CampoReais semPrefixo centavos value={t.valorBase || null} onChange={(v) => set("valorBase", v ?? 0)} testid="proposta-valor" />
              </Campo>
              <Campo rotulo="Número de meses" ajuda={`Entre ${dados.limites.mesesMin} e ${dados.limites.mesesMax}, como no anúncio.`}>
                <select className="input" value={t.meses} onChange={(e) => set("meses", Number(e.target.value))} data-testid="proposta-meses">
                  {meses.map((m) => (
                    <option key={m} value={m}>
                      {m} {m === 1 ? "mês" : "meses"}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Data de entrada">
                <CampoData className="input" value={t.dataEntrada} min={hojeBR()} onChange={(e) => set("dataEntrada", e.target.value)} data-testid="proposta-data" />
              </Campo>
              <Campo rotulo="Pessoas (opcional)" ajuda={dados.limites.capacidade ? `O imóvel recebe até ${dados.limites.capacidade}.` : undefined}>
                <input inputMode="numeric" className="input" value={pessoas} onChange={(e) => setPessoas(e.target.value.replace(/\D/g, "").slice(0, 2))} />
              </Campo>
            </div>
          </Panel>

          <Panel title="Encargos e itens">
            <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
              <Campo rotulo="Condomínio (R$/mês)">
                <CampoReais semPrefixo centavos value={t.condominio || null} onChange={(v) => set("condominio", v ?? 0)} />
              </Campo>
              <Campo rotulo="Consumo estimado (R$/mês)">
                <CampoReais semPrefixo centavos value={t.consumo || null} onChange={(v) => set("consumo", v ?? 0)} />
              </Campo>
              <Campo rotulo="Limpezas por mês">
                <select className="input" value={t.limpezasMes} onChange={(e) => set("limpezasMes", Number(e.target.value))}>
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "Sem limpeza" : `${n} por mês`}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Valor de cada limpeza (R$)">
                <CampoReais semPrefixo centavos value={t.valorLimpeza || null} onChange={(v) => set("valorLimpeza", v ?? 0)} />
              </Campo>
              <Campo rotulo="Taxa pet (R$/mês, se houver)">
                <CampoReais semPrefixo centavos value={t.taxaPet || null} onChange={(v) => set("taxaPet", v ?? 0)} />
              </Campo>
              <Campo rotulo="Limpeza de preparação (R$, única)">
                <CampoReais semPrefixo centavos value={t.limpezaUnica || null} onChange={(v) => set("limpezaUnica", v ?? 0)} />
              </Campo>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[13px] text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" aria-hidden /> {CAUCAO_FRASE}
            </p>
          </Panel>

          <Panel title="Desconto (opcional)">
            <div className="grid gap-4 sm:grid-cols-3 [&>*]:min-w-0">
              <Campo rotulo="Tipo">
                <select className="input" value={tipoDesconto} onChange={(e) => setTipoDesconto(e.target.value as "pct" | "valor")}>
                  <option value="pct">% no valor mensal</option>
                  <option value="valor">R$ no valor mensal</option>
                </select>
              </Campo>
              <Campo rotulo={tipoDesconto === "pct" ? "Desconto (%)" : "Desconto (R$/mês)"}>
                {tipoDesconto === "pct" ? (
                  <input
                    inputMode="decimal"
                    className="input"
                    value={t.descontoPct || ""}
                    onChange={(e) => {
                      const v = numero(e.target.value);
                      setT((x) => ({ ...x, descontoPct: Math.min(30, v), descontoValor: 0 }));
                    }}
                    data-testid="proposta-desconto"
                  />
                ) : (
                  <CampoReais
                    semPrefixo
                    centavos
                    value={t.descontoValor || null}
                    onChange={(v) => setT((x) => ({ ...x, descontoPct: 0, descontoValor: v ?? 0 }))}
                    testid="proposta-desconto"
                  />
                )}
              </Campo>
              <Campo rotulo="Motivo">
                <select className="input" value={t.motivoDesconto ?? ""} onChange={(e) => set("motivoDesconto", e.target.value || null)}>
                  <option value="">Selecione</option>
                  {MOTIVOS_DESCONTO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            {termos.descontoEstadiaPct > 0 && (
              <p className="mt-3 text-[13px] text-forest" data-testid="desconto-estadia">
                Desconto de estadia longa do anúncio: {String(termos.descontoEstadiaPct).replace(".", ",")}% (entra sozinho).
              </p>
            )}
          </Panel>

          <Panel title="Validade e mensagem">
            <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] [&>*]:min-w-0">
              <Campo rotulo="Validade">
                <select className="input" value={validade} onChange={(e) => setValidade(Number(e.target.value))} data-testid="proposta-validade">
                  {VALIDADES_DIAS.map((d) => (
                    <option key={d} value={d}>
                      {d} dias
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Mensagem (opcional)" ajuda="Sem telefone ou e-mail: a conversa segue pela plataforma.">
                <textarea rows={3} maxLength={500} className="input" value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
              </Campo>
            </div>
          </Panel>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Panel title="Resumo" data-testid="proposta-resumo">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Valor mensal</dt>
                <dd className="font-medium text-ink" data-testid="resumo-valor-mensal">{formatBRL(tot.valorMensal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Total por mês</dt>
                <dd className="font-medium text-ink" data-testid="resumo-total-mensal">{formatBRL(tot.totalMensal)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-sage-200 pt-2">
                <dt className="font-semibold text-ink">Total do contrato</dt>
                <dd className="font-title text-lg font-bold text-forest" data-testid="resumo-total-contrato">{formatBRL(tot.totalContrato)}</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted" data-testid="proposta-taxa-dono">
              Só você vê: {textoTaxaPainel(dados.taxa, tot.valorMensal, termos.meses)}.
            </p>
            {erro && (
              <p className="mt-3 text-[13px] text-red-600" role="alert" data-testid="proposta-erro">
                {erro}
              </p>
            )}
            <Button type="submit" className="mt-4 w-full" disabled={enviando} data-testid="enviar-proposta">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enviar proposta
            </Button>
            <p className="mt-2 text-[12px] text-muted">A proposta é um documento: a Viva não recebe nem guarda valores.</p>
          </Panel>
        </aside>
      </form>
    </>
  );
}
