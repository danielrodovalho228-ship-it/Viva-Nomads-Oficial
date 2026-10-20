/**
 * Liga a qualificação "à espera" (sem imóvel) ao imóvel/rascunho do mesmo dono.
 * Sem isso a prontidão do anúncio mostra "Não enviado" mesmo com o documento
 * enviado: o autosave cria o rascunho antes de qualquer outra ligação.
 * Só liga se o imóvel ainda não tem qualificação e só a mais recente sem imóvel (com as outras à espera do MESMO
 * arquivo, Prompt 35A).
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
      .select("id, document_path")
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
    if (error) return false;
    // Prompt 35A: o documento entra na fila no ENVIO (uma linha) e o "Salvar qualificação" herda o mesmo arquivo
    // em outra linha (0072). As duas à espera, com o MESMO arquivo, vão juntas para o imóvel — senão a do envio
    // ficava "sem imóvel" na fila para sempre, mesmo depois da decisão sobre a do imóvel.
    if (espera.document_path) {
      await cliente
        .from("qualification_checklists")
        .update({ property_id: propertyId })
        .eq("owner_id", ownerId)
        .is("property_id", null)
        .eq("document_path", espera.document_path);
    }
    return true;
  } catch (e) {
    console.error("[ligarQualificacaoAoImovel] erro:", e);
    return false;
  }
}

/**
 * Prompt 19: a conferência da matrícula enviada antes do rascunho existir passa a pertencer a ele. A tabela
 * (0158) só é gravada pelo servidor: aqui roda com o cliente de SERVIÇO, sempre filtrando pelo dono do login.
 */
export async function ligarMatriculaAoImovel(admin: Cliente, ownerId: string, propertyId: string): Promise<void> {
  if (!admin) return;
  try {
    await admin.from("property_ownership_checks").update({ property_id: propertyId }).eq("user_id", ownerId).is("property_id", null);
  } catch (e) {
    console.error("[ligarMatriculaAoImovel] erro:", e instanceof Error ? e.message : "desconhecido");
  }
}
