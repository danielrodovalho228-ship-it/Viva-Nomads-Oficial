import { contadoresConferencia, listConferidosAutomaticamente, listDocumentosPendentes } from "@/lib/data/documentos-admin";
import { AdminDocumentosClient } from "./admin-documentos-client";

export default async function AdminDocumentosPage() {
  const [docs, auto, contadores] = await Promise.all([
    listDocumentosPendentes(),
    listConferidosAutomaticamente(),
    contadoresConferencia(),
  ]);
  return <AdminDocumentosClient docs={docs} auto={auto} contadores={contadores} />;
}
