/**
 * Liga a qualificação "à espera" (sem imóvel) ao imóvel/rascunho do mesmo dono.
 * Sem isso a prontidão do anúncio mostra "Não enviado" mesmo com o documento
 * enviado: o autosave cria o rascunho antes de qualquer outra ligação.
 * Só liga se o imóvel ainda não tem qualificação e só a mais recente sem imóvel.
 * Roda no servidor, com o cliente da pessoa (RLS) — o dono é sempre o do login.
 */

// Cliente Supabase do servidor, tipado frouxo de propósito (mesmo padrão de prontidao-servidor.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any;

export async function ligarQualificacaoAoImovel(cliente: Cliente, ownerId: string, propertyId: string): Promise<boolean> {
  try {
    const { data: jaTem } = await cliente
      .from("qualification_checklists")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("property_id", propertyId)
      .limit(1)
      .maybeSingle();
    if (jaTem) return false;
    const { data: espera } = await cliente
      .from("qualification_checklists")
      .select("id")
      .eq("owner_id", ownerId)
      .is("property_id", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!espera) return false;
    const { error } = await cliente
      .from("qualification_checklists")
      .update({ property_id: propertyId })
      .eq("id", espera.id)
      .eq("owner_id", ownerId)
      .is("property_id", null);
    return !error;
  } catch (e) {
    console.error("[ligarQualificacaoAoImovel] erro:", e);
    return false;
  }
}
