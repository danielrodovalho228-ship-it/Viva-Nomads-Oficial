import { contadoresConferencia, listConferidosAutomaticamente, listDocumentosPendentes } from "@/lib/data/documentos-admin";
import { contadoresMatriculas, listMatriculasFila } from "@/lib/data/matriculas-admin";
import { AdminDocumentosClient } from "./admin-documentos-client";
import { MatriculasAdmin } from "./matriculas-admin-client";

export default async function AdminDocumentosPage() {
  const [docs, auto, contadores, matriculas, contMatriculas] = await Promise.all([
    listDocumentosPendentes(),
    listConferidosAutomaticamente(),
    contadoresConferencia(),
    listMatriculasFila(),
    contadoresMatriculas(),
  ]);
  return (
    <>
      <AdminDocumentosClient docs={docs} auto={auto} contadores={contadores} />
      <MatriculasAdmin itens={matriculas} contadores={contMatriculas} />
    </>
  );
}
