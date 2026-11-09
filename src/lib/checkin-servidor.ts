import type { SupabaseClient } from "@supabase/supabase-js";

/** Instruções de entrada completas? (tabela só do servidor, 0127). Usar com o cliente de serviço, nunca no browser. */
export async function instrucoesPreenchidas(admin: SupabaseClient, contratoId: string): Promise<boolean> {
  const { data, error } = await admin.from("contratos_checkin").select("horario, instrucoes, plantao").eq("contrato_id", contratoId).maybeSingle();
  // Falha de leitura NÃO é "instruções em branco": o dono seria barrado ao assinar por engano.
  if (error) throw new Error("Não foi possível conferir as instruções de entrada agora.");
  return !!(data?.horario && data?.instrucoes && data?.plantao);
}
