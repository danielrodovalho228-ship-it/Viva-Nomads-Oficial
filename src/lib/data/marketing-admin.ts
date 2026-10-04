"use server";

import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { erroBancoPT } from "@/lib/erros-banco";
import { validarGasto, type GastoEntrada, type GastoMarketing } from "@/lib/marketing";

type ActionResult = { ok: boolean; demo?: boolean; error?: string };

/** Admin: gastos de marketing (0067). A RLS só deixa o admin ler/gravar. */
export async function listarGastosMarketing(): Promise<{ gastos: GastoMarketing[]; aviso: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { gastos: [], aviso: null };
  const { data, error } = await supabase
    .from("gastos_marketing")
    .select("id, mes, canal, valor, observacao")
    .order("mes", { ascending: false })
    .order("criado_em", { ascending: false })
    .limit(1000);
  if (error) {
    // Sem a 0067 aplicada a tabela não existe: a tela explica em vez de quebrar.
    return { gastos: [], aviso: "A tabela de gastos ainda não existe no banco (migração 0067 pendente)." };
  }
  return {
    gastos: (data ?? []).map((g) => ({ ...g, valor: Number(g.valor) }) as GastoMarketing),
    aviso: null,
  };
}

async function exigirAdmin() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, erro: null as string | null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, erro: "Não autenticado." };
  if (!(await ehAdmin(supabase, user.id))) return { supabase: null, erro: "Sem permissão." };
  return { supabase, erro: null };
}

export async function lancarGastoMarketing(entrada: GastoEntrada): Promise<ActionResult> {
  const v = validarGasto(entrada);
  if (!v.ok) return { ok: false, error: v.erro };
  const { supabase, erro } = await exigirAdmin();
  if (erro) return { ok: false, error: erro };
  if (!supabase) return { ok: true, demo: true };
  const { error } = await supabase.from("gastos_marketing").insert(v.linha);
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true };
}

export async function apagarGastoMarketing(id: string): Promise<ActionResult> {
  const { supabase, erro } = await exigirAdmin();
  if (erro) return { ok: false, error: erro };
  if (!supabase) return { ok: true, demo: true };
  const { error } = await supabase.from("gastos_marketing").delete().eq("id", id);
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true };
}
