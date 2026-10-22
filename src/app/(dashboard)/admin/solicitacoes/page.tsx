import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Wrench } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { adminDaPagina, intervaloBRT, solicitacoesManutencao, urgentesSemResposta4h } from "@/lib/data/admin-indicadores";
import { periodoDaLista } from "@/lib/admin/indicadores";
import { somarDias, rotuloPeriodo } from "@/lib/admin/visao-geral";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { hojeBR } from "@/lib/utils";

export const metadata = { title: "Solicitações de manutenção — Admin", robots: { index: false, follow: false } };
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
  const admin = await adminDaPagina();
  const lista = admin ? (urgentes ? await urgentesSemResposta4h(admin) : await solicitacoesManutencao(admin, intervaloBRT(p.inicio, p.fim), cidade)) : [];
  const resolvidas = lista.filter((s) => s.resolved_at).length;

  return (
    <div data-testid="admin-solicitacoes">
      <PageTitle
        title="Solicitações de manutenção"
        subtitle={
          urgentes
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
        <strong data-testid="lista-total">{lista.length}</strong> {lista.length === 1 ? "solicitação" : "solicitações"} {urgentes ? "urgentes sem resposta" : "abertas no período"} ·{" "}
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
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
