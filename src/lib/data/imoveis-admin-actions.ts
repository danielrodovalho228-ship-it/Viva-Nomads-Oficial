"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { recusaObservador } from "@/lib/qa/observador";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Admin → Imóveis (Prompt 29, item 5): pausa um anúncio ativo (sai da busca) e grava no log de admin. A RLS
 * is_admin() libera o update; quem não é admin recebe "Sem permissão".
 */
export async function pausarImovelAdmin(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID.test(id)) return { ok: false, error: "Imóvel inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Sem conexão com o banco." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };
  const recusaQa = await recusaObservador(user.id, { imoveis: [id] });
  if (recusaQa) return { ok: false, error: recusaQa };
  const { data, error } = await supabase.from("properties").update({ status: "paused" }).eq("id", id).eq("status", "active").select("id").maybeSingle();
  if (error) {
    console.error("[pausarImovelAdmin]", error.code, error.message);
    return { ok: false, error: "Não foi possível pausar agora." };
  }
  if (!data) return { ok: false, error: "O anúncio não está ativo." };
  await logModeracao(supabase, user.id, "pausar_imovel", "property", id, "Pausado pela equipe em /admin/imoveis");
  revalidatePath("/admin/imoveis");
  return { ok: true };
}
