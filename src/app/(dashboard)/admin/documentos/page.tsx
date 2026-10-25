import { contadoresConferencia, listConferidosAutomaticamente, listDocumentosPendentes } from "@/lib/data/documentos-admin";
import { contadoresMatriculas, listMatriculasFila } from "@/lib/data/matriculas-admin";
import { AdminDocumentosClient } from "./admin-documentos-client";
import { MatriculasAdmin } from "./matriculas-admin-client";
import { listarFalhasDocumentos } from "@/lib/data/documentos-falhas-actions";
import { FalhasDocumentos } from "./falhas-client";
import { VerificacoesRevisao } from "@/components/admin/verificacoes-revisao";
import { adminDaPagina, filaDocumentos } from "@/lib/data/admin-indicadores";
import { listarVinculosPendentes } from "@/lib/data/triagem-actions";
import { triagemVinculoAtiva } from "@/lib/triagem/chave";
import { VinculosAdmin } from "./vinculos-admin-client";
import { EmitidosAdmin } from "./emitidos-client";
import { listarEmitidos } from "@/lib/data/emitidos-actions";
import { ABA_EMITIDOS, filtrosEmitidos } from "@/lib/fiscal/emitidos";
import { PREFIXOS, type Prefixo } from "@/lib/fiscal/prefixos";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { tituloDoAdmin } from "@/config/menu-admin";

type ClienteAdmin = NonNullable<Awaited<ReturnType<typeof adminDaPagina>>>;

/** Data da decisão mais recente de uma fila — o "nada pendente" mostra quando a equipe decidiu por último (Prompt 48). */
async function ultimaDecisao(admin: ClienteAdmin | null, tabela: "properties" | "property_ownership_checks", coluna: string): Promise<string | null> {
  if (!admin) return null;
  const { data } = await admin.from(tabela).select(coluna).not(coluna, "is", null).order(coluna, { ascending: false }).limit(1);
  const linha = (data?.[0] ?? null) as Record<string, string | null> | null;
  return linha?.[coluna] ?? null;
}

/** L2-B item 14: duas abas — a fila de conferência (como antes) e "Emitidos" (?aba=emitidos). */
function Abas({ atual }: { atual: "fila" | "emitidos" }) {
  const aba = (chave: "fila" | "emitidos", href: string, rotulo: string) => (
    <Link
      href={href}
      aria-current={atual === chave ? "page" : undefined}
      className={cn("rounded-lg px-3 py-2 text-sm", atual === chave ? "bg-forest text-white" : "text-ink hover:bg-surface-2")}
      data-testid={`documentos-aba-${chave}`}
    >
      {rotulo}
    </Link>
  );
  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Seções de documentos">
      {aba("fila", "/admin/documentos", "Fila de conferência")}
      {aba("emitidos", `/admin/documentos?aba=${ABA_EMITIDOS}`, "Emitidos")}
    </nav>
  );
}

export const metadata = { title: tituloDoAdmin("/admin/documentos") };

export default async function AdminDocumentosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  if (sp.aba === ABA_EMITIDOS) {
    const filtros = filtrosEmitidos(sp);
    const itens = await listarEmitidos(filtros);
    const tipos = (Object.keys(PREFIXOS) as Prefixo[]).map((k) => ({ valor: k, rotulo: PREFIXOS[k].rotulo }));
    return (
      <>
        <Abas atual="emitidos" />
        <EmitidosAdmin itens={itens} filtros={filtros} tipos={tipos} />
      </>
    );
  }
  const admin = await adminDaPagina();
  // Prompt 52: a fila do vínculo só existe com a chave TRIAGEM_VINCULO_ATIVA.
  const triagemLigada = await triagemVinculoAtiva();
  const vinculos = triagemLigada ? await listarVinculosPendentes() : null;
  const [docs, auto, contadores, matriculas, contMatriculas, falhas, filaAgora, ultimaDoc, ultimaMatricula] = await Promise.all([
    listDocumentosPendentes(),
    listConferidosAutomaticamente(),
    contadoresConferencia(),
    listMatriculasFila(),
    contadoresMatriculas(),
    listarFalhasDocumentos(),
    admin ? filaDocumentos(admin).catch(() => null) : Promise.resolve(null),
    ultimaDecisao(admin, "properties", "document_reviewed_at").catch(() => null),
    ultimaDecisao(admin, "property_ownership_checks", "revisado_em").catch(() => null),
  ]);
  return (
    <>
      <Abas atual="fila" />
      <AdminDocumentosClient docs={docs} auto={auto} contadores={contadores} filaAgora={filaAgora} ultimaDecisao={ultimaDoc} />
      <MatriculasAdmin itens={matriculas} contadores={contMatriculas} ultimaDecisao={ultimaMatricula} />
      <FalhasDocumentos falhas={falhas.falhas} pendentes={falhas.pendentes} />
      <VerificacoesRevisao />
      {triagemLigada ? <VinculosAdmin itens={vinculos?.itens ?? []} metricas={vinculos?.metricas ?? { pendentes: 0, aprovados: 0, recusados: 0 }} /> : null}
    </>
  );
}
