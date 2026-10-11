import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { pendenciasParaSocios, type LinhaPendencia, type Pendencia } from "./pendencias";

/**
 * Lê as aprovações pendentes (service_role SÓ aqui, leitura, colunas sem dado pessoal). Chamar apenas
 * depois de guardSocios(): a página já está atrás do código dos sócios. Falha → lista vazia (a página não cai).
 */
export async function carregarPendenciasSocios(): Promise<Pendencia[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("aprovacoes")
    .select("tipo, referencia, resumo, risco, status, expira_em")
    .eq("status", "pendente")
    .order("criado_em", { ascending: false })
    .limit(20);
  if (error) return [];
  return pendenciasParaSocios(data as LinhaPendencia[], new Date());
}
