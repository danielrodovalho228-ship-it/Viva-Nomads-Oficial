import { getResumoAdmin } from "@/lib/data/admin-painel";
import { AdminPainelClient } from "./admin-painel-client";

/**
 * Painel de admin — números REAIS, lidos no servidor a cada visita
 * (o layout já exige admin; as funções conferem de novo).
 */
export default async function AdminPage() {
  const resumo = await getResumoAdmin();
  // Por que não há números: sem Supabase é o modo demonstração; com Supabase e
  // sem a chave de serviço, é configuração faltando (não "demonstração").
  const aviso = resumo
    ? null
    : !process.env.NEXT_PUBLIC_SUPABASE_URL
      ? "Sem conexão com o banco (modo demonstração): nenhum número real para mostrar."
      : !process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "Chave de serviço não configurada (SUPABASE_SERVICE_ROLE_KEY): os números não podem ser lidos."
        : "Não foi possível ler os números agora.";
  return <AdminPainelClient resumo={resumo} aviso={aviso} />;
}
