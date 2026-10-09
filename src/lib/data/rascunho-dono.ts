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
