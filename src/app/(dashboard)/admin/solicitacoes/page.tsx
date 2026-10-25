import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Wrench } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { adminDaPagina, intervaloBRT, solicitacoesManutencao, urgentesSemResposta4h } from "@/lib/data/admin-indicadores";
import { periodoDaLista } from "@/lib/admin/indicadores";
import { somarDias, rotuloPeriodo } from "@/lib/admin/visao-geral";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { hojeBR } from "@/lib/utils";
import { manutencaoForaDoPrazo, pedidosDeReclassificacao, taxasDeSolucaoDosDonos } from "@/lib/data/admin-prazos-59";
import { estadoSolucao } from "@/lib/manutencao-solucao";
import { ReclassificarOrdem } from "@/components/admin/reclassificar-ordem";
import type { UrgenciaManutencao } from "@/config/atendimento";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";

export const metadata = { title: tituloDoAdmin("/admin/solicitacoes"), robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { aberto: "Aberta", visto: "Vista", em_andamento: "Em andamento", resolvido: "Resolvida" };

/**
 * Admin → Solicitações de manutenção (Prompt 29, item 1): a lista que o cartão "Solicitações de manutenção abertas" da
 * home conta, com o mesmo período e cidade. Não é a fila de atendimento (essa fica em /admin/atendimento).
 */
export default async function AdminSolicitacoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const um = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const hoje = hojeBR();
  const p = periodoDaLista({ de: um("de"), ate: um("ate") }) ?? { inicio: somarDias(hoje, -29), fim: hoje };
  const cidade = (um("cidade") ?? "").trim().slice(0, 80) || null;
  // "Chamados urgentes sem resposta há mais de 4 h" (fila do "Precisa de você agora"): agora, sem período.
  const urgentes = um("prioridade") === "urgente" && um("sem_resposta") === "1";
  // Prompt 59: "Manutenção fora do prazo" (topo das decisões) e pedidos de reclassificação do dono.
  const foraPrazo = um("fora_prazo") === "1";
  const reclass = um("reclassificacao") === "1";
  const admin = await adminDaPagina();
  const agora = new Date();
  const lista = admin
    ? foraPrazo
      ? await manutencaoForaDoPrazo(admin, agora)
      : reclass
        ? await pedidosDeReclassificacao(admin)
        : urgentes
          ? await urgentesSemResposta4h(admin)
          : await solicitacoesManutencao(admin, intervaloBRT(p.inicio, p.fim), cidade)
    : [];
  const taxas = admin ? await taxasDeSolucaoDosDonos(admin, agora).catch(() => []) : [];
  const resolvidas = lista.filter((s) => s.resolved_at).length;

  return (
    <div data-testid="admin-solicitacoes">
      <PageTitle
        title={rotuloDoAdmin("/admin/solicitacoes")}
        subtitle={
          foraPrazo
            ? "Abertas com o prazo de solução vencido · agora · sem simulações nem contas de teste"
            : reclass
              ? "O proprietário pediu outra prioridade · quem decide é o atendimento da Viva"
              : urgentes
            ? "Urgentes sem resposta do proprietário há mais de 4 h · agora · sem simulações"
            : `${rotuloPeriodo(p.inicio, p.fim)}${cidade ? ` · ${cidade}` : ""} · imóveis reais, sem simulações nem contas de teste`
        }
        action={
          <Link href="/admin" className="text-sm text-forest underline">
            Voltar à visão geral
          </Link>
        }
      />
      <p className="mb-4 text-sm text-ink">
        <strong data-testid="lista-total">{lista.length}</strong> {lista.length === 1 ? "solicitação" : "solicitações"} {foraPrazo ? "fora do prazo de solução" : reclass ? "com pedido de reclassificação" : urgentes ? "urgentes sem resposta" : "abertas no período"} ·{" "}
        {resolvidas} {resolvidas === 1 ? "resolvida" : "resolvidas"}. Horários no horário de Brasília (BRT).
      </p>
      <Panel title="Solicitações">
        {lista.length === 0 ? (
          <EmptyState icon={Wrench} title="Nenhuma solicitação no período" text="Mude o período na visão geral para ver outras." action={<ButtonLink href="/admin" variant="secondary" size="sm">Mudar o período na visão geral</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-sage-100">
            {lista.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm" data-testid="solicitacao-linha">
                <span className="min-w-0">
                  <span className="font-semibold text-ink">{s.properties.title ?? "Imóvel"}</span>
                  <span className="text-muted">
                    {" "}
                    · {s.category ?? "—"} · prioridade {s.priority ?? "—"} · {STATUS[s.status] ?? s.status}
                  </span>
                </span>
                <span className="text-xs text-muted">
                  aberta {dataHoraBRT(s.opened_at, { tabela: true })}
                  {s.first_response_at ? ` · 1ª resposta ${dataHoraBRT(s.first_response_at, { tabela: true })}` : " · sem resposta"}
                  {s.status !== "resolvido" && (s.priority === "urgente" || s.priority === "media" || s.priority === "baixa") && (
                    <span data-testid="solicitacao-solucao"> · {estadoSolucao({ priority: s.priority, openedAt: s.opened_at, status: s.status, resolvedAt: s.resolved_at }, agora).texto}</span>
                  )}
                </span>
                {s.status !== "resolvido" && (s.priority === "urgente" || s.priority === "media" || s.priority === "baixa") && (
                  <ReclassificarOrdem id={s.id} atual={s.priority as UrgenciaManutencao} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Prompt 59, item 13: a fórmula escrita aqui e no código (taxaSolucaoNoPrazo). */}
      <Panel title="Solução no prazo por proprietário" className="mt-6" data-testid="taxa-solucao">
        <p className="text-sm text-muted">
          Chamados resolvidos no prazo ÷ chamados resolvidos, nos últimos 12 meses. Só aparece a partir de 3 chamados resolvidos. Prazos de solução:
          urgente 24 h (provisória) e 72 h (definitiva), média 72 h, baixa 7 dias, contados da abertura.
        </p>
        {taxas.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nenhum proprietário com 3 ou mais chamados resolvidos ainda.</p>
        ) : (
          <ul className="mt-2 divide-y divide-sage-100 text-sm">
            {taxas.map((t) => (
              <li key={t.donoId} className="flex justify-between gap-3 py-2" data-testid="taxa-solucao-linha">
                <span className="min-w-0 truncate text-ink">{t.nome}</span>
                <span className="shrink-0 text-muted">
                  {Math.round(t.taxa * 100)}% · {t.noPrazo} de {t.resolvidos}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
