import { filaAjudaPublicacaoAdmin } from "@/lib/data/ajuda-publicacao-actions";
import { AjudaPublicacaoClient } from "./ajuda-publicacao-client";
import { tituloDoAdmin } from "@/config/menu-admin";
import { soLeituraNaTela } from "@/lib/qa/observador";

export const metadata = { title: tituloDoAdmin("/admin/ajuda-publicacao") };

export default async function AdminAjudaPublicacaoPage() {
  const fila = await filaAjudaPublicacaoAdmin();
  // E477: a conta observadora da QA só lê (o servidor também recusa).
  const soLeitura = (await soLeituraNaTela([{ id: "configuracao" }])).length > 0;
  return <AjudaPublicacaoClient fila={fila} soLeitura={soLeitura} />;
}
