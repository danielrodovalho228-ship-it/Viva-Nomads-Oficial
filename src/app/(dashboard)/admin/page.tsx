import { getResumoAdmin, listChecklistsPendentes } from "@/lib/data/admin-painel";
import { AdminPainelClient } from "./admin-painel-client";

/**
 * Painel de admin — números e fila REAIS, lidos no servidor a cada visita
 * (o layout já exige admin; as funções conferem de novo).
 */
export default async function AdminPage() {
  const [resumo, checklists] = await Promise.all([getResumoAdmin(), listChecklistsPendentes()]);
  return <AdminPainelClient resumo={resumo} checklists={checklists} />;
}
