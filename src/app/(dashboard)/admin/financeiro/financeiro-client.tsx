"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Info } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { FiltrosAdmin } from "@/components/admin/filtros";
import { BarrasMensais, LinhaMensal } from "@/components/admin/graficos";
import { cn, dataBR } from "@/lib/utils";
import { fmtInteiro, fmtPct, fmtReais, rotuloPeriodo, type Num, type Periodo } from "@/lib/admin/visao-geral";
import { calcularFinanceiro, csvFinanceiro, mesCurto, STATUS_COMISSAO } from "@/lib/admin/financeiro";

/**
 * /admin/financeiro: receita recorrente (MRR/ARR/churn/ARPU/LTV), o que entrou
 * de fato pelo Asaas, comissões por contrato, take rate e marketing (CAC/ROI).
 * Sem dado → "—"; o "i" de cada cartão explica a conta.
 */
export function FinanceiroClient({
  dados,
  geradoEm,
  aviso,
  periodo,
  cidade,
  cidades,
}: {
  dados: Record<string, unknown> | null;
  geradoEm: string | null;
  aviso: string | null;
  periodo: Periodo;
  cidade: string | null;
  cidades: string[];
}) {
  const f = calcularFinanceiro(dados);
  const reais = (v: Num) => fmtReais(v);
  const serie = (pegar: (m: (typeof f.mensal)[number]) => Num) =>
    f.mensal.map((m) => ({ mes: m.mes, rotuloMes: mesCurto(m.mes), v: pegar(m) }));

  function baixarCsv() {
    const blob = new Blob(["﻿" + csvFinanceiro(f, periodo.inicio, periodo.fim, cidade)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-financeiro-${periodo.inicio}-a-${periodo.fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageTitle title="Financeiro" subtitle="Receita recorrente, o que entrou, comissões e retorno do marketing." />
      <FiltrosAdmin base="/admin/financeiro" periodo={periodo} cidade={cidade} cidades={cidades} />

      {aviso && (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{aviso}</p>
      )}
      {f.historicoDesde && (
        <p className="mb-6 rounded-xl border border-sage-200 bg-sage-100 px-4 py-3 text-sm text-ink">
          O histórico de assinaturas começa em {dataBR(f.historicoDesde)}. Antes disso, MRR no tempo e churn aparecem como &quot;—&quot;.
        </p>
      )}
      {cidade && (
        <p className="mb-6 text-sm text-muted">
          Assinaturas e marketing não têm cidade: com o filtro de cidade, aparecem como &quot;—&quot;. Comissões e contratos são da cidade do imóvel.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {rotuloPeriodo(periodo.inicio, periodo.fim)} ({periodo.dias} {periodo.dias === 1 ? "dia" : "dias"})
          {cidade ? ` · ${cidade}` : ""}
        </p>
        <button
          type="button"
          onClick={baixarCsv}
          disabled={!dados}
          className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm text-ink hover:border-forest disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Baixar CSV
        </button>
      </div>

      <div className="grid gap-6">
        <Panel title="Receita recorrente (assinaturas)">
          <Grade>
            <Cartao rotulo="MRR agora" valor={reais(f.mrrAgora)} formula={`Assinaturas ativas × preço mensal do plano (tabela de planos).${f.semPreco ? ` ${f.semPreco} no Gestor, sob consulta, ficam fora.` : ""}`} />
            <Cartao rotulo="ARR" valor={reais(f.arr)} formula="MRR × 12. Projeção anual do que é recorrente hoje." />
            <Cartao rotulo="Assinaturas ativas" valor={fmtInteiro(f.ativas)} formula="Assinaturas com pagamento em dia agora." />
            <Cartao rotulo="MRR no início do período" valor={reais(f.mrrInicio)} formula="Assinaturas ativas no 1º dia do período × preço. Antes do início do histórico: —." />
            <Cartao rotulo="Novas no período" valor={fmtInteiro(f.novas)} formula="Assinaturas que passaram a ativas dentro do período." />
            <Cartao rotulo="Saídas no período" valor={fmtInteiro(f.saidas)} formula="Assinaturas que deixaram de estar ativas (venceu ou cancelou) dentro do período." />
            <Cartao rotulo="Churn mensal" valor={fmtPct(f.churnMensal)} formula="Saídas nos últimos 30 dias ÷ assinaturas ativas 30 dias antes. Sem 30 dias de histórico: —." />
            <Cartao rotulo="ARPU" valor={reais(f.arpu)} formula="MRR ÷ assinaturas ativas: quanto cada assinante paga por mês, em média." />
            <Cartao rotulo="LTV" valor={reais(f.ltv)} formula="ARPU ÷ churn mensal: quanto um assinante deixa, em média, até sair. Churn zero ou sem histórico: —." />
          </Grade>
        </Panel>

        <Panel title="O que entrou no período (Asaas)">
          <Grade>
            <Cartao rotulo="Assinaturas recebidas" valor={reais(f.recebidoAssinatura)} formula="Soma dos pagamentos de assinatura confirmados pelo Asaas no período." />
            <Cartao rotulo="Comissões recebidas" valor={reais(f.recebidoComissao)} formula="Soma das comissões de fechamento pagas no período (cidade do imóvel)." />
            <Cartao rotulo="Total recebido" valor={reais(f.recebidoTotal)} formula="Assinaturas + comissões recebidas no período." />
          </Grade>
        </Panel>

        <Panel title="Comissões dos contratos do período">
          <Grade>
            <Cartao rotulo="Comissão gerada" valor={reais(f.comissaoGerada)} formula="Soma da comissão dos contratos fechados no período (cobrada só do proprietário, uma vez por contrato)." />
            <Cartao rotulo="A receber" valor={reais(f.comissaoAReceber)} formula="Comissão dos contratos do período ainda não paga (aguardando, vencida ou sem cobrança)." />
            <Cartao
              rotulo="Aluguel contratado"
              valor={reais(f.aluguelContratado)}
              nota="valor contratado entre as partes (não passa pela plataforma)"
              formula="Soma do aluguel mensal dos contratos do período. É acertado entre proprietário e inquilino; a plataforma não recebe esse valor."
            />
            <Cartao rotulo="Take rate" valor={fmtPct(f.takeRate)} formula="Comissão gerada ÷ aluguel mensal contratado, nos contratos do período. Sem contrato: —." />
          </Grade>
          <TabelaComissoes linhas={f.comissoes} />
        </Panel>

        <Panel title="Marketing">
          <Grade>
            <Cartao
              rotulo="Gasto"
              valor={reais(f.gastoMarketing)}
              formula={`Gastos lançados em /admin/marketing nos meses tocados pelo período${f.mesesMarketing.length ? ` (${f.mesesMarketing.map(mesCurto).join(", ")})` : ""}.`}
            />
            <Cartao rotulo="Proprietários novos" valor={fmtInteiro(f.novosProprietarios)} formula="Contas de proprietário criadas nos mesmos meses do gasto." />
            <Cartao rotulo="CAC" valor={reais(f.cac)} formula="Gasto ÷ proprietários novos. Sem gasto lançado ou sem proprietário novo: —." />
            <Cartao rotulo="ROI" valor={fmtPct(f.roi)} formula="(Total recebido − gasto) ÷ gasto. Sem gasto lançado: —." />
          </Grade>
          <p className="mt-3 text-sm">
            <Link href="/admin/marketing" className="font-medium text-forest underline">
              Lançar gastos de marketing
            </Link>
          </p>
        </Panel>

        <Panel title="Mês a mês (12 meses)">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">Total recebido</h3>
              <BarrasMensais dados={serie((m) => m.receitaTotal)} rotulo="Total recebido" formatar={reais} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-ink">MRR no fim do mês</h3>
              <LinhaMensal dados={serie((m) => m.mrrFimMes)} rotulo="MRR" formatar={reais} />
            </div>
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted">Ver como tabela</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="py-1.5 font-medium">Mês</th>
                    <th className="py-1.5 text-right font-medium">Assinaturas</th>
                    <th className="py-1.5 text-right font-medium">Comissões</th>
                    <th className="py-1.5 text-right font-medium">Marketing</th>
                    <th className="py-1.5 text-right font-medium">Proprietários novos</th>
                    <th className="py-1.5 text-right font-medium">MRR fim do mês</th>
                  </tr>
                </thead>
                <tbody>
                  {f.mensal.map((m) => (
                    <tr key={m.mes} className="border-b border-line/60">
                      <td className="py-1.5 text-ink">{mesCurto(m.mes)}</td>
                      <td className="py-1.5 text-right text-ink">{reais(m.receitaAssinatura)}</td>
                      <td className="py-1.5 text-right text-ink">{reais(m.receitaComissao)}</td>
                      <td className="py-1.5 text-right text-ink">{reais(m.gastoMarketing)}</td>
                      <td className="py-1.5 text-right text-ink">{fmtInteiro(m.novosProprietarios)}</td>
                      <td className="py-1.5 text-right text-ink">{reais(m.mrrFimMes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Panel>
      </div>

      {geradoEm && (
        <p className="mt-6 text-xs text-muted">
          Atualizado às{" "}
          {new Date(geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}. Os números
          ficam guardados por até 5 minutos.
        </p>
      )}
    </>
  );
}

function Grade({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>;
}

function Cartao({ rotulo, valor, formula, nota }: { rotulo: string; valor: string; formula: string; nota?: string }) {
  const [aberto, setAberto] = useState(false);
  const id = `f-${rotulo.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="min-w-0 rounded-xl border border-line p-3" data-indicador={id}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-muted">{rotulo}</span>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls={id}
          aria-label={`Como é calculado: ${rotulo}`}
          className="shrink-0 rounded-full p-0.5 text-muted hover:text-forest"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 font-title text-2xl font-bold text-ink" data-valor>
        {valor}
      </p>
      {valor === "—" && <p className="text-xs text-muted">sem dados no período</p>}
      {nota && <p className="mt-1 text-xs text-muted">{nota}</p>}
      {aberto && (
        <p id={id} className="mt-2 rounded-lg bg-sage-100 px-2.5 py-2 text-xs text-ink">
          {formula}
        </p>
      )}
    </div>
  );
}

function TabelaComissoes({ linhas }: { linhas: ReturnType<typeof calcularFinanceiro>["comissoes"] }) {
  if (linhas.length === 0) return <p className="mt-4 text-sm text-muted">— nenhum contrato no período</p>;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-muted">
            <th className="py-1.5 pr-3 font-medium">Data</th>
            <th className="py-1.5 font-medium">Imóvel</th>
            <th className="py-1.5 font-medium">Plano</th>
            <th className="py-1.5 pl-3 text-right font-medium">Aluguel*</th>
            <th className="py-1.5 pl-3 text-right font-medium">Comissão</th>
            <th className="py-1.5 pl-4 font-medium">Situação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((c) => (
            <tr key={c.contrato} className="border-b border-line/60">
              <td className="whitespace-nowrap py-1.5 pr-3 text-ink">{dataBR(c.data)}</td>
              <td className="py-1.5 text-ink">
                {c.imovel ?? "—"}
                {c.cidade ? <span className="text-muted"> · {c.cidade}</span> : null}
              </td>
              <td className="py-1.5 text-ink">
                {c.plano ?? "—"}
                {c.percentual !== null ? <span className="text-muted"> ({fmtPct(c.percentual)})</span> : null}
              </td>
              <td className="py-1.5 pl-3 text-right text-ink">{fmtReais(c.aluguel)}</td>
              <td className="py-1.5 pl-3 text-right text-ink">{fmtReais(c.comissao)}</td>
              <td className={cn("py-1.5 pl-4", c.status === "vencido" ? "text-red-700" : c.status === "pago" ? "text-green-700" : "text-ink")}>
                {STATUS_COMISSAO[c.status] ?? c.status}
                {c.pago_em ? <span className="text-muted"> · {dataBR(c.pago_em)}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">* Aluguel: valor contratado entre as partes (não passa pela plataforma).</p>
    </div>
  );
}
