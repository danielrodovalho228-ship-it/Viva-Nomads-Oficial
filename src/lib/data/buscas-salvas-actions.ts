"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LIMITE_BUSCAS_SALVAS, normalizarBusca, resumoDaBusca } from "@/lib/busca/buscas-salvas";
import { notificacaoLigada } from "@/lib/notifications/preferencias";

/**
 * Buscas salvas (ordem d15ef6bf) — sempre como a própria pessoa (RLS da 0122:
 * cada um lê/cria/apaga só as suas). Visitante sem login recebe `precisaEntrar`.
 */
export type BuscaSalva = { id: string; parametros: string; resumo: string; criadoEm: string; alertaAtivo: boolean };
type Res<T> = ({ ok: true } & T) | { ok: false; error: string; precisaEntrar?: boolean };

async function sessao() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

/** A busca atual já está salva? (null = visitante). */
export async function buscaEstaSalva(qs: string): Promise<{ salva: boolean | null }> {
  const s = await sessao();
  if (!s) return { salva: null };
  const parametros = normalizarBusca(qs);
  const { data } = await s.supabase.from("buscas_salvas").select("id").eq("usuario_id", s.user.id).eq("parametros", parametros).maybeSingle();
  return { salva: !!data };
}

/**
 * Salva (ou, se já salva, remove) a busca atual — o coração alterna. Ao salvar, devolve o id (para o "Não me avisar") e
 * se os avisos por e-mail da conta estão ligados (profiles.notif_email, o mesmo que o envio do alerta respeita).
 */
export async function alternarBuscaSalva(qs: string): Promise<Res<{ salva: boolean; id?: string | null; avisoEmail?: boolean }>> {
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre para salvar esta busca.", precisaEntrar: true };
  const parametros = normalizarBusca(qs);
  const { data: existente } = await s.supabase
    .from("buscas_salvas")
    .select("id")
    .eq("usuario_id", s.user.id)
    .eq("parametros", parametros)
    .maybeSingle();
  if (existente) {
    const { error } = await s.supabase.from("buscas_salvas").delete().eq("id", existente.id);
    if (error) return { ok: false, error: "Não foi possível remover a busca. Tente de novo." };
    revalidatePath("/dashboard/buscas");
    return { ok: true, salva: false };
  }
  const { count } = await s.supabase.from("buscas_salvas").select("id", { count: "exact", head: true }).eq("usuario_id", s.user.id);
  if ((count ?? 0) >= LIMITE_BUSCAS_SALVAS) return { ok: false, error: `Você já tem ${LIMITE_BUSCAS_SALVAS} buscas salvas. Apague uma em Buscas salvas.` };
  const { data: nova, error } = await s.supabase
    .from("buscas_salvas")
    .insert({ usuario_id: s.user.id, parametros, resumo: resumoDaBusca(parametros) })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "Não foi possível salvar a busca. Tente de novo." };
  revalidatePath("/dashboard/buscas");
  const { data: perfil } = await s.supabase.from("profiles").select("notif_email").eq("id", s.user.id).maybeSingle();
  return { ok: true, salva: true, id: (nova?.id as string | undefined) ?? null, avisoEmail: notificacaoLigada(perfil?.notif_email as boolean | null | undefined) };
}

/** Buscas salvas da própria pessoa (mais recentes primeiro). */
export async function listarBuscasSalvas(): Promise<BuscaSalva[]> {
  const s = await sessao();
  if (!s) return [];
  const consulta = (colunas: string) =>
    s.supabase.from("buscas_salvas").select(colunas).eq("usuario_id", s.user.id).order("criado_em", { ascending: false }).limit(LIMITE_BUSCAS_SALVAS);
  // `alerta_ativo` vem da 0137; sem ela (migração ainda não aplicada) a lista continua funcionando.
  const comAlerta = await consulta("id, parametros, resumo, criado_em, alerta_ativo");
  const data = comAlerta.error ? (await consulta("id, parametros, resumo, criado_em")).data : comAlerta.data;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    parametros: r.parametros as string,
    resumo: r.resumo as string,
    criadoEm: r.criado_em as string,
    alertaAtivo: r.alerta_ativo !== false,
  }));
}

/** Liga ou desliga o alerta por e-mail de UMA busca (RLS da 0137: só a própria pessoa). */
export async function definirAlertaBusca(id: string, ativo: boolean): Promise<Res<{ ativo: boolean }>> {
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre para gerenciar seus alertas.", precisaEntrar: true };
  if (!/^[0-9a-f-]{36}$/i.test(id) || typeof ativo !== "boolean") return { ok: false, error: "Busca inválida." };
  const { error } = await s.supabase.from("buscas_salvas").update({ alerta_ativo: ativo }).eq("id", id).eq("usuario_id", s.user.id);
  if (error) return { ok: false, error: "Não foi possível mudar o alerta. Tente de novo." };
  revalidatePath("/dashboard/buscas");
  return { ok: true, ativo };
}

/** Apaga uma busca salva (RLS garante que é da própria pessoa). */
export async function apagarBuscaSalva(id: string): Promise<Res<object>> {
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre para gerenciar suas buscas.", precisaEntrar: true };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Busca inválida." };
  const { error } = await s.supabase.from("buscas_salvas").delete().eq("id", id).eq("usuario_id", s.user.id);
  if (error) return { ok: false, error: "Não foi possível apagar. Tente de novo." };
  revalidatePath("/dashboard/buscas");
  return { ok: true };
}
