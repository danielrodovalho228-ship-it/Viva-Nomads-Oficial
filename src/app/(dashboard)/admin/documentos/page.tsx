import { listDocumentosPendentes } from "@/lib/data/documentos-admin";
import { AdminDocumentosClient } from "./admin-documentos-client";

export default async function AdminDocumentosPage() {
  const docs = await listDocumentosPendentes();
  return <AdminDocumentosClient docs={docs} />;
}
