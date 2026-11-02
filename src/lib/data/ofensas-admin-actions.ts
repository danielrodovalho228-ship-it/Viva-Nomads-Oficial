"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessaoAal2 } from "@/lib/data/admin-guard";

/*
  E445 (item 3) — a fila de moderação das ofensas no chat (só admin, com a verificação em duas etapas): quem, a
  conversa e o termo. Nunca o texto da mensagem. Leitura que falha com `exigir` LANÇA (nunca "fila vazia").
*/
export interface OfensaNaFila {
  id: string;
  autorId: string;
  autorNome: string;
  conversationId: string;
  termo: string;
  criadoEm: string;
  registrosDoAutor: number;
}

const MSG_FILA_OFENSAS_NAO_CARREGOU = "Não foi possível carregar a fila de ofensas agora.";

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
  return admin ? { admin, userId: user.id } : null;
}

export async function filaDeOfensas(opcoes: { exigir?: boolean } = {}): Promise<OfensaNaFila[] | null> {
  const a = await exigirAdmin();
  if (!a) return null;
  const { data, error } = await a.admin
    .from("moderacao_ofensas")
    .select("id, autor_id, conversation_id, termo, criado_em")
    .is("revisado_em", null)
    .order("criado_em", { ascending: false })
    .limit(200);
  if (error && opcoes.exigir) throw new Error(MSG_FILA_OFENSAS_NAO_CARREGOU);
  const linhas = (data ?? []) as { id: string; autor_id: string; conversation_id: string; termo: string; criado_em: string }[];
  const ids = [...new Set(linhas.map((l) => l.autor_id))];
  const { data: perfis } = ids.length ? await a.admin.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const nomes = new Map(((perfis ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, (p.full_name ?? "").trim() || "Sem nome"]));
  const porAutor = new Map<string, number>();
  for (const l of linhas) porAutor.set(l.autor_id, (porAutor.get(l.autor_id) ?? 0) + 1);
  return linhas.map((l) => ({
    id: l.id,
    autorId: l.autor_id,
    autorNome: nomes.get(l.autor_id) ?? "Sem nome",
    conversationId: l.conversation_id,
    termo: l.termo,
    criadoEm: l.criado_em,
    registrosDoAutor: porAutor.get(l.autor_id) ?? 1,
  }));
}

export async function marcarOfensaRevisada(id: string): Promise<{ ok: boolean }> {
  const a = await exigirAdmin();
  if (!a || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
  const { error } = await a.admin.from("moderacao_ofensas").update({ revisado_em: new Date().toISOString(), revisado_por: a.userId }).eq("id", id).is("revisado_em", null);
  return { ok: !error };
}
