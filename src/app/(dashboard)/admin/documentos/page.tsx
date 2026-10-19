import { contadoresConferencia, listConferidosAutomaticamente, listDocumentosPendentes } from "@/lib/data/documentos-admin";
import { contadoresMatriculas, listMatriculasFila } from "@/lib/data/matriculas-admin";
import { AdminDocumentosClient } from "./admin-documentos-client";
import { MatriculasAdmin } from "./matriculas-admin-client";
import { listarFalhasDocumentos } from "@/lib/data/documentos-falhas-actions";
import { FalhasDocumentos } from "./falhas-client";

export default async function AdminDocumentosPage() {
  const [docs, auto, contadores, matriculas, contMatriculas, falhas] = await Promise.all([
    listDocumentosPendentes(),
    listConferidosAutomaticamente(),
    contadoresConferencia(),
    listMatriculasFila(),
    contadoresMatriculas(),
    listarFalhasDocumentos(),
  ]);
  return (
    <>
      <AdminDocumentosClient docs={docs} auto={auto} contadores={contadores} />
      <MatriculasAdmin itens={matriculas} contadores={contMatriculas} />
      <FalhasDocumentos falhas={falhas.falhas} pendentes={falhas.pendentes} />
    </>
  );
}
