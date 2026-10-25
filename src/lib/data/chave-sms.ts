import { createAdminClient } from "@/lib/supabase/admin";
import type { ChaveSms } from "@/lib/pedidos/confirmacao";

/**
 * Chave SMS_ATIVO (Prompt 30). Fonte única: a linha 'SMS_ATIVO' de public.chaves_plataforma (0184) — o banco usa a
 * mesma linha para decidir quem aparece no mural (pedido_visivel_para_donos), então tela, e-mail e mural nunca
 * divergem. Desligada por padrão. Server-only (sem "use server": nunca é chamada pelo navegador).
 * Sem banco ou sem a migração: desligada (o comportamento de produção hoje).
 */
export async function lerChaveSms(): Promise<ChaveSms> {
  const admin = createAdminClient();
  if (!admin) return { ligada: false, ligadaEm: null };
  const { data, error } = await admin.from("chaves_plataforma").select("ligada, ligada_em").eq("chave", "SMS_ATIVO").maybeSingle();
  if (error || !data) return { ligada: false, ligadaEm: null };
  return { ligada: data.ligada === true, ligadaEm: (data.ligada_em as string | null) ?? null };
}
