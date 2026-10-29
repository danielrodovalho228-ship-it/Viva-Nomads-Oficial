import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { avisoResumoPorta, chaveResumoPorta, diaDoResumo, janelaDoDia } from "./resumo-porta";

/**
 * Põe na fila de avisos do Daniel, uma vez por dia, o resumo das entradas do admin observador no dia anterior.
 * Chamado pelo /api/cron/avisos-daniel antes do envio. Sem entradas, nada. A chave em automacoes_envios segura o
 * "uma vez" (gravada antes do aviso).
 */
export async function resumoDiarioPortaQa(admin: SupabaseClient, agora: Date = new Date()): Promise<number> {
  const dia = diaDoResumo(agora);
  const { de, ate } = janelaDoDia(dia);
  const { data } = await admin.from("qa_entradas").select("criado_em, destino").eq("tipo", "admin_qa").gte("criado_em", de).lt("criado_em", ate).order("criado_em");
  const aviso = avisoResumoPorta(dia, (data ?? []) as { criado_em: string; destino: string | null }[]);
  if (!aviso) return 0;
  const { error } = await admin.from("automacoes_envios").insert({ chave: chaveResumoPorta(dia), tipo: "porta_qa_resumo" });
  if (error) return 0;
  await admin.from("avisos_daniel").insert(aviso);
  return 1;
}
