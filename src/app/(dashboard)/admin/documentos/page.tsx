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

type ClienteAdmin = NonNullable<Awaited<ReturnType<typeof adminDaPagina>>>;

/** Data da decisão mais recente de uma fila — o "nada pendente" mostra quando a equipe decidiu por último (Prompt 48). */
async function ultimaDecisao(admin: ClienteAdmin | null, tabela: "properties" | "property_ownership_checks", coluna: string): Promise<string | null> {
  if (!admin) return null;
  const { data } = await admin.from(tabela).select(coluna).not(coluna, "is", null).order(coluna, { ascending: false }).limit(1);
  const linha = (data?.[0] ?? null) as Record<string, string | null> | null;
  return linha?.[coluna] ?? null;
}

export default async function AdminDocumentosPage() {
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
      <AdminDocumentosClient docs={docs} auto={auto} contadores={contadores} filaAgora={filaAgora} ultimaDecisao={ultimaDoc} />
      <MatriculasAdmin itens={matriculas} contadores={contMatriculas} ultimaDecisao={ultimaMatricula} />
      <FalhasDocumentos falhas={falhas.falhas} pendentes={falhas.pendentes} />
      <VerificacoesRevisao />
      {triagemLigada ? <VinculosAdmin itens={vinculos?.itens ?? []} metricas={vinculos?.metricas ?? { pendentes: 0, aprovados: 0, recusados: 0 }} /> : null}
    </>
  );
}
