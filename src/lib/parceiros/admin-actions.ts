"use server";

import { sessaoAal2 } from "@/lib/data/admin-guard";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehUuid } from "@/lib/fotografos/regras";

export type StatusInteresse = "novo" | "contatado" | "arquivado";
const STATUS_VALIDOS: readonly StatusInteresse[] = ["novo", "contatado", "arquivado"];

/** Admin muda o status de um interesse de parceria. Autorização no servidor (papel admin) e de novo na RLS. */
export async function atualizarStatusInteresse(id: string, status: string): Promise<{ ok: boolean; erro?: string }> {
  if (!ehUuid(id)) return { ok: false, erro: "Registro inválido." };
  if (!STATUS_VALIDOS.includes(status as StatusInteresse)) return { ok: false, erro: "Status inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Indisponível no modo demonstração." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sem permissão." };
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (perfil?.role !== "admin" || !(await sessaoAal2(supabase))) return { ok: false, erro: "Sem permissão." };
  const { error } = await supabase.from("parceiros_interesse").update({ status }).eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível atualizar." };
  revalidatePath("/admin/parceiros");
  revalidatePath("/admin");
  return { ok: true };
}
