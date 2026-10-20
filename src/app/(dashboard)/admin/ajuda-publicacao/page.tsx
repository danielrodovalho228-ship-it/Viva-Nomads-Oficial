import { filaAjudaPublicacaoAdmin } from "@/lib/data/ajuda-publicacao-actions";
import { AjudaPublicacaoClient } from "./ajuda-publicacao-client";

export default async function AdminAjudaPublicacaoPage() {
  const fila = await filaAjudaPublicacaoAdmin();
  return <AjudaPublicacaoClient fila={fila} />;
}
