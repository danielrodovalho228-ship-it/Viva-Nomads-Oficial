import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function idValido(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

/** Grava (ou atualiza) UMA marca do usuário logado. A RLS garante que só mexe nas próprias. Best-effort. */
export async function gravarMarca(
  supabase: SupabaseClient,
  userId: string,
  imovelId: string,
  campo: "visto_em" | "contatado_em"
): Promise<boolean> {
  if (!idValido(imovelId)) return false;
  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("imovel_marcas")
    .upsert(
      { user_id: userId, imovel_id: imovelId, [campo]: agora, atualizado_em: agora },
      { onConflict: "user_id,imovel_id" }
    );
  if (error) console.error("[marcas] falha ao gravar:", error.code);
  return !error;
}
