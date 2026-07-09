/**
 * Emissão da URL da foto de perfil — SERVER-ONLY (sem "use server": funções de
 * apoio reutilizadas por Server Components e por server actions).
 *
 * A trava de visibilidade é `podeVerAvatar` (regra pura). AQUI está o encanamento:
 * o bucket é PRIVADO, então a URL assinada é emitida com o SERVICE ROLE — mas
 * SEMPRE depois de `podeVerAvatar` dar true. Sem service role (sandbox/local),
 * tudo devolve null e a UI cai para as iniciais.
 */

import { createAdminClient, AVATARS_BUCKET, AVATAR_SIGNED_TTL } from "@/lib/supabase/admin";

/** Assina um caminho do bucket privado de avatares. null se não puder. */
export async function signAvatarPath(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage
    .from(AVATARS_BUCKET)
    .createSignedUrl(path, AVATAR_SIGNED_TTL);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * Existe relação ACEITA entre um proprietário e um inquilino? (libera a foto do
 * inquilino). Duas fontes, ambas = aceite mútuo consumado:
 *  1) contrato entre as partes (o inquilino é `tenant_id` de um imóvel do dono);
 *  2) resposta de Pedido de Moradia com status `aceita_para_conversa` (o
 *     inquilino aceitou a resposta daquele proprietário).
 * FAIL-CLOSED: qualquer erro/dúvida → false (esconde a foto).
 */
export async function relacaoAceitaEntreServidor(
  ownerId: string,
  tenantId: string
): Promise<boolean> {
  if (!ownerId || !tenantId || ownerId === tenantId) return false;
  const admin = createAdminClient();
  if (!admin) return false;

  try {
    // 1) Contrato: imóvel do dono + tenant_id = inquilino.
    const { data: props } = await admin
      .from("properties")
      .select("id")
      .eq("owner_id", ownerId);
    const propIds = (props ?? []).map((p: { id: string }) => p.id);
    if (propIds.length > 0) {
      const { data: contrato } = await admin
        .from("contratos")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("property_id", propIds)
        .limit(1)
        .maybeSingle();
      if (contrato) return true;
    }

    // 2) Resposta de Pedido de Moradia aceita pelo inquilino.
    const { data: pedidos } = await admin
      .from("pedidos_moradia")
      .select("id")
      .eq("inquilino_id", tenantId);
    const pedidoIds = (pedidos ?? []).map((p: { id: string }) => p.id);
    if (pedidoIds.length > 0) {
      const { data: resposta } = await admin
        .from("respostas_pedido")
        .select("id")
        .eq("proprietario_id", ownerId)
        .eq("status", "aceita_para_conversa")
        .in("pedido_id", pedidoIds)
        .limit(1)
        .maybeSingle();
      if (resposta) return true;
    }
  } catch {
    return false; // fail-closed
  }
  return false;
}

/** Lê o caminho da foto de um usuário no profiles (via admin). null se não há. */
export async function getAvatarPath(userId: string): Promise<string | null> {
  if (!userId) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .maybeSingle();
  return (data?.avatar_url as string | null) ?? null;
}
