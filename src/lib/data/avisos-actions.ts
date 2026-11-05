"use server";

import { createClient } from "@/lib/supabase/server";
import { resumoDosAvisos, type PrioridadeAviso } from "@/lib/notifications/avisos";
import { urlDoAvisoComConversa } from "@/lib/notifications/url-conversa";

/*
  E444, item 2 — o sino do site (servidor): contagem de não lidas e a maior prioridade pendente, a lista e as ações de
  marcar lido. Tudo com o cliente da pessoa: a RLS (0286) só deixa ler e marcar os próprios avisos, e só a coluna lido_em.
*/
export interface AvisoDoSino {
  id: string;
  evento: string;
  prioridade: PrioridadeAviso;
  titulo: string;
  /** E482: a linha de texto (ex.: a prévia da mensagem nova). */
  texto: string | null;
  url: string | null;
  criado_em: string;
  lido_em: string | null;
  resolvido_em: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MSG_AVISOS_SEM_LEITURA = "Não foi possível carregar os avisos agora.";

async function sessao() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

/** Não lidas e a maior prioridade ainda pendente. Sem sessão: null. Falha de leitura LANÇA (nunca "0 avisos"). */
export async function resumoDoSino(): Promise<{ naoLidas: number; maiorPrioridade: PrioridadeAviso | null } | null> {
  const s = await sessao();
  if (!s) return null;
  const { data, error } = await s.supabase.from("avisos").select("prioridade, lido_em, resolvido_em").eq("usuario_id", s.userId).is("lido_em", null).limit(500);
  if (error) throw new Error(MSG_AVISOS_SEM_LEITURA);
  return resumoDosAvisos((data ?? []) as { prioridade: PrioridadeAviso; lido_em: string | null; resolvido_em: string | null }[]);
}

/** Os avisos mais recentes da pessoa. Falha de leitura LANÇA. */
export async function meusAvisos(limite = 30): Promise<AvisoDoSino[] | null> {
  const s = await sessao();
  if (!s) return null;
  const n = Math.min(Math.max(1, Math.round(limite)), 100);
  const ler = (colunas: string) => s.supabase.from("avisos").select(colunas).eq("usuario_id", s.userId).order("criado_em", { ascending: false }).order("id", { ascending: false }).limit(n);
  let { data, error } = await ler("id, evento, prioridade, titulo, texto, url, ref_id, criado_em, lido_em, resolvido_em");
  // Sem a 0298 aplicada (coluna texto), lê como antes — o aviso sai só com o título.
  if (error?.code === "42703") ({ data, error } = await ler("id, evento, prioridade, titulo, url, ref_id, criado_em, lido_em, resolvido_em"));
  if (error) throw new Error(MSG_AVISOS_SEM_LEITURA);
  // E541: aviso de mensagem nova gravado antes da correção (url sem ?conversa=) abre a conversa pelo ref_id.
  return ((data ?? []) as unknown as (AvisoDoSino & { ref_id: string | null })[]).map((a) => ({
    id: a.id,
    evento: a.evento,
    prioridade: a.prioridade,
    titulo: a.titulo,
    texto: a.texto ?? null,
    url: urlDoAvisoComConversa(a),
    criado_em: a.criado_em,
    lido_em: a.lido_em,
    resolvido_em: a.resolvido_em,
  }));
}

export async function marcarAvisoLido(id: string): Promise<{ ok: boolean }> {
  const s = await sessao();
  if (!s || !UUID.test(id)) return { ok: false };
  const { error } = await s.supabase.from("avisos").update({ lido_em: new Date().toISOString() }).eq("id", id).eq("usuario_id", s.userId).is("lido_em", null);
  return { ok: !error };
}

export async function marcarTodosAvisosLidos(): Promise<{ ok: boolean }> {
  const s = await sessao();
  if (!s) return { ok: false };
  const { error } = await s.supabase.from("avisos").update({ lido_em: new Date().toISOString() }).eq("usuario_id", s.userId).is("lido_em", null);
  return { ok: !error };
}
