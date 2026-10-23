import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { urlInterna } from "./montar-email";
import { sendPush } from "./push";
import { decisaoDoPush, grupoDaConversa, textoMensagensAgrupadas } from "./regra-push";

/*
  Prompt 44 — o push de cada notify(), decidido pela matriz (regra-push.ts): sai agora, espera as 7h em push_adiados
  (0226) ou não sai. Mensagem nova: só sem a conversa aberta há 10 min, com a contagem da conversa e sem o texto.
  Sem a 0226 (tabela ausente), o adiado não sai e a mensagem segue sem a regra dos 10 min: o e-mail e a central não mudam.
*/

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
export type ResultadoPush = { sent: number } | { skipped: true } | { adiado: true };

export interface PedidoPush {
  userId: string;
  event: string;
  title: string;
  body: string;
  url?: string;
  /** Prazo que vence no próprio dia: fura o silêncio. */
  prazoHoje?: boolean;
  /** Mensagem nova: a conversa (regra dos 10 min e agrupamento) e quem escreveu (só o primeiro nome vai ao push). */
  conversationId?: string;
  remetenteNome?: string | null;
  agora?: Date;
}

const MAX_JANELA_AGRUPAR_MS = 24 * 3_600_000;

async function contextoDaConversa(admin: Admin, userId: string, conversationId: string, agora: Date): Promise<{ abertaEm: string | null; novas: number }> {
  const { data: ab } = await admin.from("conversa_aberturas").select("aberta_em").eq("user_id", userId).eq("conversation_id", conversationId).maybeSingle();
  const abertaEm = (ab as { aberta_em?: string } | null)?.aberta_em ?? null;
  const desde = new Date(Math.max(abertaEm ? Date.parse(abertaEm) : 0, agora.getTime() - MAX_JANELA_AGRUPAR_MS)).toISOString();
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("receiver_id", userId)
    .gt("created_at", desde);
  return { abertaEm, novas: count ?? 1 };
}

export async function processarPush(p: PedidoPush, admin: Admin | null = createAdminClient()): Promise<ResultadoPush> {
  const agora = p.agora ?? new Date();
  let { title, body } = p;
  let grupo: string | null = null;
  let abertaEm: string | null = null;
  if (p.event === "new_message" && p.conversationId && admin) {
    const c = await contextoDaConversa(admin, p.userId, p.conversationId, agora).catch(() => ({ abertaEm: null, novas: 1 }));
    abertaEm = c.abertaEm;
    ({ title, body } = textoMensagensAgrupadas(c.novas, p.remetenteNome));
    grupo = grupoDaConversa(p.conversationId);
  }
  const d = decisaoDoPush({ evento: p.event, agora, prazoHoje: p.prazoHoje, conversaAbertaEm: abertaEm });
  if (d.tipo === "nao") return { skipped: true };
  const url = urlInterna(p.url);
  if (d.tipo === "adiar") {
    if (!admin) return { skipped: true };
    const linha = { user_id: p.userId, evento: p.event, titulo: title.slice(0, 120), corpo: body.slice(0, 240), url, grupo, sair_em: d.ate.toISOString() };
    const { error } = grupo
      ? await admin.from("push_adiados").upsert(linha, { onConflict: "user_id,grupo" })
      : await admin.from("push_adiados").insert(linha);
    if (error) console.error("[push] adiar", error.code);
    return error ? { skipped: true } : { adiado: true };
  }
  return sendPush({ userId: p.userId, title, body, url });
}

/** Cron das 7h (Brasília): envia os pushes que esperaram o silêncio e apaga cada um depois de tentar. */
export async function enviarPushAdiados(admin: Admin, agora: Date = new Date()): Promise<{ enviados: number; pendentes: number }> {
  const { data, error } = await admin.from("push_adiados").select("id, user_id, titulo, corpo, url").lte("sair_em", agora.toISOString()).order("sair_em").limit(500);
  if (error || !data) return { enviados: 0, pendentes: 0 };
  let enviados = 0;
  for (const l of data as { id: string; user_id: string; titulo: string; corpo: string; url: string | null }[]) {
    const r = await sendPush({ userId: l.user_id, title: l.titulo, body: l.corpo, url: l.url ?? undefined }).catch(() => null);
    if (r && "sent" in r && r.sent > 0) enviados++;
    await admin.from("push_adiados").delete().eq("id", l.id);
  }
  return { enviados, pendentes: data.length };
}

/** A pessoa abriu a conversa agora (a próxima mensagem dos próximos 10 min não vira push). Best-effort. */
export async function registrarAberturaDaConversa(userId: string, conversationId: string, admin: Admin | null = createAdminClient()): Promise<void> {
  if (!admin) return;
  await admin
    .from("conversa_aberturas")
    .upsert({ user_id: userId, conversation_id: conversationId, aberta_em: new Date().toISOString() }, { onConflict: "user_id,conversation_id" })
    .then(undefined, () => {});
}
