import Link from "next/link";
import { Activity } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { adminDaPagina, eventosDoPeriodo, intervaloBRT } from "@/lib/data/admin-indicadores";
import { EVENTOS_HOME, periodoDaLista, type TipoEventoHome } from "@/lib/admin/indicadores";
import { rotuloPeriodo, somarDias } from "@/lib/admin/visao-geral";
import { dataBRT } from "@/lib/datas-brasilia";
import { hojeBR } from "@/lib/utils";

export const metadata = { title: "Relatório de eventos — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Admin → Relatório de eventos (complemento do P29, item 4): buscas, anúncios vistos, candidaturas começadas e os
 * formulários de cadastro e de anúncio. São eventos ANÔNIMOS (sem pessoa): a lista é o total por dia, no mesmo período
 * e cidade da home, contas de teste fora (mesma regra da 0181).
 */
export default async function AdminEventosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const um = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 80) : "");
  const tipo = (um("tipo") in EVENTOS_HOME ? um("tipo") : "busca") as TipoEventoHome;
  const hoje = hojeBR();
  const p = periodoDaLista({ de: um("de"), ate: um("ate") }) ?? { inicio: somarDias(hoje, -29), fim: hoje };
  const cidade = um("cidade") || null;
  const admin = await adminDaPagina();
  const eventos = admin ? await eventosDoPeriodo(admin, intervaloBRT(p.inicio, p.fim), cidade, [tipo]) : [];
  const porDia = new Map<string, number>();
  for (const e of eventos) {
    const d = dataBRT(e.criadoEm);
    porDia.set(d, (porDia.get(d) ?? 0) + 1);
  }
  const dias = [...porDia.entries()].sort((a, b) => b[0].split("/").reverse().join("").localeCompare(a[0].split("/").reverse().join("")));
  const qs = new URLSearchParams({ de: p.inicio, ate: p.fim, ...(cidade ? { cidade } : {}) }).toString();

  return (
    <div data-testid="admin-eventos">
      <PageTitle
        title={`Relatório: ${EVENTOS_HOME[tipo]}`}
        subtitle={`${rotuloPeriodo(p.inicio, p.fim)}${cidade ? ` · ${cidade}` : ""} · eventos anônimos, contas de teste fora`}
        action={
          <Link href="/admin" className="text-sm text-forest underline">
            Voltar à visão geral
          </Link>
        }
      />
      <nav aria-label="Tipo de evento" className="mb-4 flex flex-wrap gap-1.5">
        {(Object.keys(EVENTOS_HOME) as TipoEventoHome[]).map((t) => (
          <Link
            key={t}
            href={`/admin/eventos?tipo=${t}&${qs}`}
            aria-current={t === tipo ? "page" : undefined}
            className={t === tipo ? "rounded-lg bg-forest px-3 py-1.5 text-sm text-white" : "rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:border-forest"}
          >
            {EVENTOS_HOME[t]}
          </Link>
        ))}
      </nav>
      <p className="mb-4 text-sm text-ink">
        <strong data-testid="lista-total">{eventos.length}</strong> no período ({dias.length} {dias.length === 1 ? "dia" : "dias"} com registro).
      </p>
      <Panel title="Por dia (horário de Brasília)">
        {dias.length === 0 ? (
          <EmptyState icon={Activity} title="Nenhum registro no período" text="Mude o período na visão geral para ver outros dias." />
        ) : (
          <ul className="divide-y divide-sage-100">
            {dias.map(([d, n]) => (
              <li key={d} className="flex justify-between gap-2 py-2 text-sm" data-testid="evento-dia">
                <span className="text-ink">{d}</span>
                <strong className="text-ink">{n}</strong>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
