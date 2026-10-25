import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Inbox } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { adminDaPagina, candidaturasDoPeriodo, candidaturasSemResposta48h, intervaloBRT, type CandidaturaAdmin } from "@/lib/data/admin-indicadores";
import { periodoDaLista } from "@/lib/admin/indicadores";
import { rotuloPeriodo, somarDias } from "@/lib/admin/visao-geral";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { hojeBR } from "@/lib/utils";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";

export const metadata = { title: tituloDoAdmin("/admin/candidaturas"), robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const FILTROS = {
  sem_resposta: "Sem resposta há mais de 48 h (agora)",
  respondida: "Respondidas (aceitas ou recusadas)",
  aceita: "Aceitas",
} as const;
type Filtro = keyof typeof FILTROS;

const situacao = (c: CandidaturaAdmin) => (c.aceitaEm ? "Aceita" : c.recusadaEm ? "Recusada" : "Aguardando o proprietário");

/**
 * Admin → Candidaturas (complemento do P29, item 4): a lista que os números de candidaturas da home contam — no período
 * e cidade da home, imóveis e contas reais (mesma regra da 0181). "Sem resposta" é a fila do "Precisa de você agora".
 */
export default async function AdminCandidaturasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const um = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 80) : "");
  const status = (um("status") in FILTROS ? um("status") : "") as Filtro | "";
  const hoje = hojeBR();
  const p = periodoDaLista({ de: um("de"), ate: um("ate") }) ?? { inicio: somarDias(hoje, -29), fim: hoje };
  const cidade = um("cidade") || null;
  const admin = await adminDaPagina();
  let lista: CandidaturaAdmin[] = [];
  if (admin) {
    if (status === "sem_resposta") lista = await candidaturasSemResposta48h(admin);
    else {
      const todas = await candidaturasDoPeriodo(admin, intervaloBRT(p.inicio, p.fim), cidade);
      lista = status === "aceita" ? todas.filter((c) => c.aceitaEm) : status === "respondida" ? todas.filter((c) => c.aceitaEm || c.recusadaEm) : todas;
    }
  }
  const subtitulo =
    status === "sem_resposta"
      ? "Agora · imóveis e contas reais"
      : `${rotuloPeriodo(p.inicio, p.fim)}${cidade ? ` · ${cidade}` : ""}${status ? ` · ${FILTROS[status]}` : ""} · imóveis e contas reais`;

  return (
    <div data-testid="admin-candidaturas">
      <PageTitle
        title={rotuloDoAdmin("/admin/candidaturas")}
        subtitle={subtitulo}
        action={
          <Link href="/admin" className="text-sm text-forest underline">
            Voltar à visão geral
          </Link>
        }
      />
      <p className="mb-4 text-sm text-ink">
        <strong data-testid="lista-total">{lista.length}</strong> {lista.length === 1 ? "candidatura" : "candidaturas"} nesta lista. Horários no
        horário de Brasília (BRT).
      </p>
      <Panel title="Candidaturas">
        {lista.length === 0 ? (
          <EmptyState icon={Inbox} title="Nenhuma candidatura nesta lista" text="Mude o período na visão geral para ver outras." action={<ButtonLink href="/admin" variant="secondary" size="sm">Mudar o período na visão geral</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-sage-100">
            {lista.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm" data-testid="candidatura-linha">
                <span className="min-w-0">
                  <span className="font-semibold text-ink">{c.imovel}</span>
                  <span className="text-muted">
                    {c.cidade ? ` · ${c.cidade}` : ""} · {situacao(c)}
                  </span>
                </span>
                <span className="text-xs text-muted">enviada {dataHoraBRT(c.criadoEm, { tabela: true })}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
