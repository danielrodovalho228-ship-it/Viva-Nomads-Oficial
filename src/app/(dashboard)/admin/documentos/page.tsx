import { contadoresConferencia, listConferidosAutomaticamente, listDocumentosPendentes } from "@/lib/data/documentos-admin";
import { contadoresMatriculas, listMatriculasFila } from "@/lib/data/matriculas-admin";
import { AdminDocumentosClient } from "./admin-documentos-client";
import { MatriculasAdmin } from "./matriculas-admin-client";
import { listarFalhasDocumentos } from "@/lib/data/documentos-falhas-actions";
import { FalhasDocumentos } from "./falhas-client";
import { adminDaPagina, filaDocumentos } from "@/lib/data/admin-indicadores";

export default async function AdminDocumentosPage() {
  const admin = await adminDaPagina();
  const [docs, auto, contadores, matriculas, contMatriculas, falhas, filaAgora] = await Promise.all([
    listDocumentosPendentes(),
    listConferidosAutomaticamente(),
    contadoresConferencia(),
    listMatriculasFila(),
    contadoresMatriculas(),
    listarFalhasDocumentos(),
    admin ? filaDocumentos(admin).catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <>
      <AdminDocumentosClient docs={docs} auto={auto} contadores={contadores} filaAgora={filaAgora} />
      <MatriculasAdmin itens={matriculas} contadores={contMatriculas} />
      <FalhasDocumentos falhas={falhas.falhas} pendentes={falhas.pendentes} />
    </>
  );
}
