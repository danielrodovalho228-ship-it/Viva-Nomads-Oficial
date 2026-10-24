"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AVATARS_BUCKET, createAdminClient } from "@/lib/supabase/admin";
import { sessaoAal2 } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { signAvatarPath } from "@/lib/data/avatar-url";
import { notify } from "@/lib/notifications";
import { avisoRemocao, motivoRemocaoValido, ordenarFila, textoRemocao, type StatusFoto } from "@/lib/perfil/foto-revisao";

/**
 * FOTO-PERFIL-B (E13) — fila de revisão das fotos de perfil (/admin/fotos-perfil). Os dados reais da fila são vistos
 * pelo admin (papel admin + 2FA), nunca por automação. Toda escrita é pelo service_role depois da checagem; a RLS da
 * 0244 deixa a pessoa ler só as próprias linhas.
 */

type Res<T = null> = { ok: true; valor: T } | { ok: false; erro: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function exigirAdmin() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (perfil?.role !== "admin" || !(await sessaoAal2(supabase))) return null;
  const admin = createAdminClient();
  return admin ? { supabase, admin, user } : null;
}

export interface FotoNaFila {
  id: string;
  userId: string;
  nome: string;
  enviadaEm: string;
  denunciadaEm: string | null;
  url: string | null;
}

/** Fila: denunciadas no topo, depois a mais antiga primeiro. null = sem permissão. */
export async function filaFotosPerfil(): Promise<FotoNaFila[] | null> {
  const a = await exigirAdmin();
  if (!a) return null;
  const { data } = await a.admin.from("fotos_perfil_revisao").select("id, user_id, caminho, enviada_em, denunciada_em").eq("status", "em_revisao").limit(200);
  const linhas = (data ?? []) as { id: string; user_id: string; caminho: string; enviada_em: string; denunciada_em: string | null }[];
  const ids = [...new Set(linhas.map((l) => l.user_id))];
  const { data: perfis } = ids.length ? await a.admin.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const nomes = new Map((perfis ?? []).map((p) => [p.id as string, ((p.full_name as string | null) ?? "").trim() || "Sem nome"]));
  const itens = await Promise.all(
    linhas.map(async (l) => ({ id: l.id, userId: l.user_id, nome: nomes.get(l.user_id) ?? "Sem nome", enviadaEm: l.enviada_em, denunciadaEm: l.denunciada_em, url: await signAvatarPath(l.caminho, l.user_id) })),
  );
  return ordenarFila(itens);
}

export async function aprovarFotoPerfil(id: string): Promise<Res> {
  if (!UUID.test(id)) return { ok: false, erro: "Registro inválido." };
  const a = await exigirAdmin();
  if (!a) return { ok: false, erro: "Sem permissão." };
  const { data, error } = await a.admin
    .from("fotos_perfil_revisao")
    .update({ status: "aprovada", revisado_por: a.user.id, revisado_em: new Date().toISOString(), denunciada_em: null })
    .eq("id", id)
    .eq("status", "em_revisao")
    .select("user_id");
  if (error) return { ok: false, erro: "Não foi possível aprovar agora." };
  if (data?.length) await logModeracao(a.supabase, a.user.id, "foto_perfil_aprovada", "perfil", data[0].user_id as string);
  revalidatePath("/admin/fotos-perfil");
  return { ok: true, valor: null };
}

/**
 * Remove com motivo da lista fechada: apaga o arquivo, limpa o avatar do perfil, guarda o motivo e avisa a pessoa
 * UMA vez (na Conta e por e-mail, com "Enviar outra foto"). Repetir não avisa de novo.
 */
export async function removerFotoPerfil(id: string, motivo: string): Promise<Res> {
  if (!UUID.test(id)) return { ok: false, erro: "Registro inválido." };
  if (!motivoRemocaoValido(motivo)) return { ok: false, erro: "Escolha o motivo da remoção." };
  const a = await exigirAdmin();
  if (!a) return { ok: false, erro: "Sem permissão." };
  const { data, error } = await a.admin
    .from("fotos_perfil_revisao")
    .update({ status: "removida", motivo, revisado_por: a.user.id, revisado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "em_revisao")
    .select("user_id, caminho");
  if (error) return { ok: false, erro: "Não foi possível remover agora." };
  const linha = (data ?? [])[0] as { user_id: string; caminho: string } | undefined;
  if (!linha) return { ok: true, valor: null };
  await a.admin.storage.from(AVATARS_BUCKET).remove([linha.caminho]);
  await a.admin.from("profiles").update({ avatar_url: null, avatar_atualizado_em: new Date().toISOString() }).eq("id", linha.user_id).eq("avatar_url", linha.caminho);
  await logModeracao(a.supabase, a.user.id, "foto_perfil_removida", "perfil", linha.user_id, motivo);
  try {
    const { data: p } = await a.admin.from("profiles").select("email, full_name, notif_email").eq("id", linha.user_id).maybeSingle();
    const d = p as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    await notify({
      event: "foto_perfil_removida",
      email: d?.notif_email === false ? undefined : (d?.email ?? undefined),
      name: d?.full_name ?? undefined,
      userId: linha.user_id,
      pushUrl: "/dashboard/conta/perfil",
      body: (n) => textoRemocao(motivo, n),
    });
  } catch {
    /* o aviso é complemento: a foto já saiu e o motivo aparece na Conta */
  }
  revalidatePath("/admin/fotos-perfil");
  return { ok: true, valor: null };
}

/** Na Conta: o motivo da última remoção, enquanto a pessoa não enviar foto nova (o aviso dentro do app). */
export async function minhaFotoRemovida(): Promise<{ motivo: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { motivo: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { motivo: null };
  // Pela RLS: a pessoa lê só as próprias linhas.
  const [{ data: ultima }, { data: perfil }] = await Promise.all([
    supabase.from("fotos_perfil_revisao").select("status, motivo").eq("user_id", user.id).order("enviada_em", { ascending: false }).limit(1).maybeSingle(),
    createAdminClient()?.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle() ?? Promise.resolve({ data: null }),
  ]);
  const u = ultima as { status: StatusFoto; motivo: string | null } | null;
  return { motivo: avisoRemocao(u, !!(perfil as { avatar_url: string | null } | null)?.avatar_url) };
}
