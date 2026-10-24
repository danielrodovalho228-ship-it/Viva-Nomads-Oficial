/**
 * FOTO-PERFIL-B (E13) — apoio do servidor (sem "use server"): a denúncia "Foto de perfil inadequada" devolve a foto
 * atual da pessoa para 'em_revisao', no TOPO da fila (denunciada_em). Quem chama já conferiu a sessão e o chamado.
 */
import type { createAdminClient } from "@/lib/supabase/admin";
import { avatarPath } from "@/lib/avatar-image";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Reabre a revisão da foto atual de `userId`. Sem foto, nada a fazer (false). */
export async function reabrirFotoPorDenuncia(admin: Admin, userId: string): Promise<boolean> {
  const { data: p } = await admin.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
  const caminho = (p as { avatar_url: string | null } | null)?.avatar_url ?? null;
  if (caminho !== avatarPath(userId)) return false;
  const agora = new Date().toISOString();
  const { data: aberta } = await admin.from("fotos_perfil_revisao").update({ denunciada_em: agora }).eq("user_id", userId).eq("status", "em_revisao").select("id");
  if (aberta?.length) return true;
  // A última decisão foi "aprovada": a mesma foto volta para a fila (nova linha, o histórico fica).
  const { error } = await admin.from("fotos_perfil_revisao").insert({ user_id: userId, caminho, denunciada_em: agora });
  return !error;
}
