import { filaAjudaPublicacaoAdmin } from "@/lib/data/ajuda-publicacao-actions";
import { AjudaPublicacaoClient } from "./ajuda-publicacao-client";
import { tituloDoAdmin } from "@/config/menu-admin";

export const metadata = { title: tituloDoAdmin("/admin/ajuda-publicacao") };

export default async function AdminAjudaPublicacaoPage() {
  const fila = await filaAjudaPublicacaoAdmin();
  return <AjudaPublicacaoClient fila={fila} />;
}
