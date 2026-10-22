"use client";

import Link from "next/link";
import { Building2, KeyRound, Wallet, AlertTriangle, CircleDot, CalendarClock, Hourglass } from "lucide-react";
import { PageTitle, Panel, StatCard, EmptyState } from "@/components/dashboard/primitives";
import { FORMULAS_CARTEIRA, indicadoresCarteira, type ItemCarteira, type SituacaoCarteira } from "@/lib/carteira-dono";
import { addDiasISO } from "@/lib/contrato-blocos";
import { useDashDemo, useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_PORTFOLIO } from "@/lib/demo/seed";
import { dataBR, formatBRL } from "@/lib/utils";

/**
 * Análise da carteira (complemento do prompt 27, item 8). A fonte é o BANCO (getCarteiraDoDono, lida no servidor e
 * recebida em `itens`). Só o modo demonstração do admin troca a fonte pelo seed em memória — as duas nunca se misturam.
 */
export function CarteiraClient({ itens }: { itens: ItemCarteira[] }) {
  const demo = useDashDemo();
  const { on: adminDemo } = useDemoMode();
  const fonte: ItemCarteira[] = demo ? DEMO_PORTFOLIO : itens;

  if (fonte.length === 0) {
    return (
      <>
        <PageTitle capa="carteira" title="Análise da carteira" subtitle="Ocupação, valor mensal e vencimentos de todos os seus imóveis ativos." />
        <EmptyState
          icon={Building2}
          title="Sua carteira está vazia"
          text="Quando você tiver imóveis ativos, a visão consolidada — ocupação, valor mensal e vencimentos — aparece aqui."
        />
      </>
    );
  }

  const m = indicadoresCarteira(fonte);
  const vagos = fonte.filter((i) => i.situacao === "vago");

  return (
    <div data-testid="carteira-analise">
      <PageTitle
        capa="carteira"
        title="Análise da carteira"
        subtitle="Ocupação, valor mensal e vencimentos de todos os seus imóveis ativos."
        action={adminDemo ? <DemoBadge /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <div data-testid="carteira-ind-ativos" data-valor={m.ativos}>
          <StatCard label="Imóveis ativos" value={m.ativos} icon={Building2} />
        </div>
        <div data-testid="carteira-ind-ocupacao" data-valor={m.ocupacaoPct}>
          <StatCard label="Ocupação" value={`${m.ocupacaoPct}%`} icon={CircleDot} hint={`${m.ocupados} de ${m.ativos} ocupados`} />
        </div>
        <div data-testid="carteira-ind-reservados" data-valor={m.reservados}>
          <StatCard label="Reservados" value={m.reservados} icon={Hourglass} hint="Aguardando assinatura ou 1º pagamento" />
        </div>
        <div data-testid="carteira-ind-vagos" data-valor={m.vagos}>
          <StatCard label="Vagos" value={m.vagos} icon={KeyRound} />
        </div>
        <div data-testid="carteira-ind-receita" data-valor={m.receitaVigencia}>
          <StatCard label="Receita mensal em vigência" value={formatBRL(m.receitaVigencia)} icon={Wallet} />
        </div>
        <div data-testid="carteira-ind-a-comecar" data-valor={m.contratadaAComecar}>
          <StatCard label="Contratada a começar" value={formatBRL(m.contratadaAComecar)} icon={CalendarClock} />
        </div>
      </div>

      <Panel title="Como calculamos" className="mt-6">
        <ul className="space-y-2 text-sm text-ink" data-testid="carteira-formulas">
          {Object.values(FORMULAS_CARTEIRA).map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Vencimentos">
          <div className="grid gap-3" data-testid="carteira-vencimentos">
            <ColunaVencimento titulo="Em até 30 dias" tom="urgente" itens={m.vence30} faixa="30" />
            <ColunaVencimento titulo="De 31 a 60 dias" tom="atencao" itens={m.vence60} faixa="60" />
            <ColunaVencimento titulo="De 61 a 90 dias" tom="calmo" itens={m.vence90} faixa="90" />
          </div>
        </Panel>

        <Panel title="Vagos">
          {vagos.length === 0 ? (
            <p className="text-sm text-muted">Nenhum imóvel vago.</p>
          ) : (
            <ul className="space-y-3" data-testid="carteira-vagos">
              {vagos.map((i) => (
                <li key={i.propertyId} className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="carteira-vago">
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{i.titulo}</span>
                    <span className="text-xs text-muted">{i.bairro}</span>
                  </span>
                  <Link
                    href={`/dashboard/pedidos-cidade?imovel=${i.propertyId}`}
                    className="font-medium text-forest underline"
                    data-testid="carteira-pedidos-compativeis"
                  >
                    Ver pedidos compatíveis
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {m.vence30.length > 0 && (
        <div className="mt-6 rounded-xl border border-champagne bg-champagne/10 p-5">
          <h2 className="flex items-center gap-2 font-title text-sm font-semibold text-ink">
            <AlertTriangle className="h-4 w-4 text-champagne" /> Atenção
          </h2>
          <p className="mt-2 text-sm text-ink">
            {m.vence30.length === 1 ? "1 contrato termina" : `${m.vence30.length} contratos terminam`} em até 30 dias. Prepare a renovação ou anuncie a disponibilidade.
          </p>
        </div>
      )}

      <Panel title="Imóveis" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm" data-testid="carteira-tabela">
            <thead>
              <tr className="border-b border-sage-200 text-left text-muted">
                <th className="pb-2 font-medium">Imóvel</th>
                <th className="pb-2 font-medium">Situação</th>
                <th className="pb-2 font-medium">Morador</th>
                <th className="pb-2 text-right font-medium">Valor mensal</th>
                <th className="pb-2 font-medium">Início</th>
                <th className="pb-2 font-medium">Fim</th>
                <th className="pb-2 font-medium">Contrato</th>
              </tr>
            </thead>
            <tbody>
              {fonte.map((i) => (
                <tr
                  key={i.propertyId}
                  className="border-b border-sage-200/60 last:border-0"
                  data-testid="carteira-linha"
                  data-situacao={i.situacao}
                  data-imovel={i.propertyId}
                >
                  <td className="py-3">
                    <p className="font-medium text-ink">{i.titulo}</p>
                    <p className="text-xs text-muted">{i.bairro}</p>
                  </td>
                  <td className="py-3">
                    <Situacao s={i.situacao} />
                    {i.selo && (
                      <span className="mt-1 block text-xs text-muted" data-testid="carteira-selo">
                        {i.selo}
                      </span>
                    )}
                    {(i.proximos ?? []).map((p) => (
                      <span key={p.contratoId} className="mt-1 block text-xs font-medium text-forest" data-testid="carteira-proximo" data-contrato={p.contratoId}>
                        Próximo morador a partir de {p.inicio ? dataBR(p.inicio) : "—"}
                        {p.morador ? ` · ${p.morador}` : ""} ·{" "}
                        <Link href={`/dashboard/contratos/${p.contratoId}`} className="underline">
                          {p.contratoNumero}
                        </Link>
                      </span>
                    ))}
                  </td>
                  <td className="py-3 text-ink">{i.morador ?? "—"}</td>
                  <td className="py-3 text-right text-ink">{i.valorMensal > 0 ? formatBRL(i.valorMensal) : "—"}</td>
                  <td className="py-3 text-ink" data-testid="carteira-inicio">{i.inicio ? dataBR(i.inicio) : "—"}</td>
                  <td className="py-3 text-ink" data-testid="carteira-fim">
                    {i.fim ? dataBR(i.fim) : "—"}
                    {i.diasAteFim != null && i.diasAteFim >= 0 && <span className="block text-xs text-muted">em {i.diasAteFim} dias</span>}
                  </td>
                  <td className="py-3">
                    {i.contratoId ? (
                      <Link href={`/dashboard/contratos/${i.contratoId}`} className="font-medium text-forest underline" data-testid="carteira-contrato">
                        {i.contratoNumero}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

const ROTULO: Record<SituacaoCarteira, string> = { ocupado: "Ocupado", reservado: "Reservado", vago: "Vago" };
const COR: Record<SituacaoCarteira, string> = {
  ocupado: "bg-sage-100 text-forest",
  reservado: "bg-amber-50 text-amber-800",
  vago: "bg-red-50 text-red-700",
};

function Situacao({ s }: { s: SituacaoCarteira }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${COR[s]}`}>{ROTULO[s]}</span>;
}

function ColunaVencimento({ titulo, tom, itens, faixa }: { titulo: string; tom: "urgente" | "atencao" | "calmo"; itens: ItemCarteira[]; faixa: string }) {
  const dot = tom === "urgente" ? "bg-red-500" : tom === "atencao" ? "bg-champagne" : "bg-sage";
  return (
    <div className="rounded-xl border border-sage-200 p-3" data-testid={`carteira-vence-${faixa}`} data-qtd={itens.length}>
      <p className="flex items-center gap-2 text-xs font-medium text-muted">
        <span className={`h-2 w-2 rounded-full ${dot}`} /> {titulo}
      </p>
      {itens.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhum</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {itens.map((i) => (
            <li key={i.propertyId} className="text-sm" data-testid="carteira-vencimento">
              <p className="font-medium text-ink">{i.titulo}</p>
              <p className="text-xs text-muted">
                Termina em {i.fim ? dataBR(i.fim) : "—"} ({i.diasAteFim} dias){i.morador ? ` · ${i.morador}` : ""}
              </p>
              {i.fim && (
                <p className="mt-1 text-xs text-muted">Sem renovação, o imóvel fica livre a partir de {dataBR(addDiasISO(i.fim, 1))}: anuncie a disponibilidade.</p>
              )}
              {i.contratoId && (
                <Link href={`/dashboard/contratos/${i.contratoId}`} className="mt-1 inline-block text-xs font-medium text-forest underline" data-testid="carteira-preparar-renovacao">
                  Preparar renovação
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
