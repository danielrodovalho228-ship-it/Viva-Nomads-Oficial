import "server-only";
import { createClient } from "@/lib/supabase/server";
import { estadoConferenciaLista, type EstadoConferenciaLista, type RespostaConferencia } from "@/lib/conferencia";

/**
 * PROP-5 — estado da conferência de ENTRADA de cada contrato da pessoa (sem conferência = "Não aberta"), para o atalho
 * /dashboard/contratos#conferencia abrir o contrato pendente. Lê com a sessão (o RLS mostra só os contratos da pessoa),
 * em lotes de 200 ids. Mesma regra da coluna do admin (estadoConferenciaLista).
 */
export async function estadosConferenciaEntradaDaPessoa(contratoIds: string[]): Promise<Map<string, EstadoConferenciaLista>> {
  const out = new Map<string, EstadoConferenciaLista>(contratoIds.map((id) => [id, "nao_aberta"]));
  const supabase = await createClient();
  if (!supabase || contratoIds.length === 0) return out;
  for (let i = 0; i < contratoIds.length; i += 200) {
    const lote = contratoIds.slice(i, i + 200);
    const { data } = await supabase.from("conferencias").select("contrato_id, conferencia_respostas(parte, decisao, motivo)").eq("tipo", "entrada").in("contrato_id", lote);
    for (const c of (data ?? []) as unknown as { contrato_id: string; conferencia_respostas: RespostaConferencia[] | null }[]) {
      out.set(c.contrato_id, estadoConferenciaLista(true, c.conferencia_respostas ?? []));
    }
  }
  return out;
}
