/**
 * Atualiza o rascunho SÓ se ele for do dono (ordem 2475382b, achado do Moacir no #330).
 * O filtro por owner_id já impede a escrita, mas 0 linhas atualizadas não vira erro:
 * sem conferir a linha devolvida, a qualificação da pessoa seria ligada a um imóvel
 * de outro dono. Devolve `atualizou: false` quando nenhuma linha foi alterada.
 */

// Cliente Supabase do servidor, tipado frouxo de propósito (mesmo padrão de ligar-qualificacao.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any;

export type ResultadoRascunho = { atualizou: boolean; error: unknown };

export async function atualizarRascunhoDoDono(
  cliente: Cliente,
  propertyId: string,
  ownerId: string,
  campos: object,
): Promise<ResultadoRascunho> {
  const { data, error } = await cliente
    .from("properties")
    .update(campos)
    .eq("id", propertyId)
    .eq("owner_id", ownerId)
    .eq("status", "draft")
    .select("id");
  return { atualizou: !error && Array.isArray(data) && data.length === 1, error: error ?? null };
}

/** Janela (h) em que um rascunho vazio ainda é reaproveitado em vez de criar outro (ordem 378c07c4). */
export const JANELA_RASCUNHO_VAZIO_H = 72;

/**
 * Rascunho do dono criado há menos de 72 h, ainda sem preço e sem endereço: o autosave de um anúncio novo
 * (sem `id`) continua esse em vez de abrir um 2º rascunho idêntico a cada entrada no assistente.
 * Só lê linhas do próprio dono; nunca apaga nada. Devolve o id ou null.
 */
export async function rascunhoVazioRecente(
  cliente: Cliente,
  ownerId: string,
  agora: Date = new Date(),
): Promise<string | null> {
  const desde = new Date(agora.getTime() - JANELA_RASCUNHO_VAZIO_H * 3_600_000).toISOString();
  const { data, error } = await cliente
    .from("properties")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("status", "draft")
    .eq("monthly_price", 0)
    .eq("address", "")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || typeof data.id !== "string") return null;
  return data.id;
}
