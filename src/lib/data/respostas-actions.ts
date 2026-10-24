"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import {
  LIMITE_RESPOSTAS,
  MODELOS,
  MSG_CONTATO_BLOQUEADO,
  MSG_LIMITE_RESPOSTAS,
  QUANDOS,
  TEXTO_MAX,
  datasDaEstadia,
  ehQuando,
  enviarEm,
  respostasDaConversa,
  temContato,
  validarResposta,
  type Quando,
  type RespostaRapida,
} from "@/lib/respostas/regras";
import { contratoDaProgramada, type LinhaProgramada } from "@/lib/respostas/servidor";

/*
  Prompt 55-E2 — ações do dono: respostas rápidas (até 20, filtro de contato que BLOQUEIA) e mensagens programadas por
  estadia. As tabelas só são lidas pela sessão (RLS); toda gravação passa por aqui, depois do filtro.
*/

type Res<T = undefined> = { ok: true; valor: T } | { ok: false; erro: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROTA = "/dashboard/respostas-rapidas";

async function sessao() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, admin, userId: user.id } : null;
}

export async function minhasRespostas(): Promise<RespostaRapida[]> {
  const s = await sessao();
  if (!s) return [];
  const { data } = await s.supabase.from("respostas_rapidas").select("id, titulo, texto").eq("owner_id", s.userId).order("criado_em").limit(LIMITE_RESPOSTAS);
  return (data ?? []) as RespostaRapida[];
}

export async function salvarResposta(e: { id?: string | null; titulo: string; texto: string }): Promise<Res<{ id: string }>> {
  const s = await sessao();
  if (!s) return { ok: false, erro: "Entre para salvar respostas." };
  const editando = !!e.id;
  if (editando && !UUID.test(String(e.id))) return { ok: false, erro: "Resposta inválida." };
  const { count } = await s.admin.from("respostas_rapidas").select("id", { count: "exact", head: true }).eq("owner_id", s.userId);
  const v = validarResposta(e, count ?? 0, editando);
  if (!v.ok) return v;
  if (editando) {
    const { data, error } = await s.admin
      .from("respostas_rapidas")
      .update({ ...v.valor, atualizado_em: new Date().toISOString() })
      .eq("id", e.id!)
      .eq("owner_id", s.userId)
      .select("id");
    if (error || !data?.length) return { ok: false, erro: "Não foi possível salvar a resposta." };
    revalidatePath(ROTA);
    return { ok: true, valor: { id: e.id! } };
  }
  const { data, error } = await s.admin.from("respostas_rapidas").insert({ owner_id: s.userId, ...v.valor }).select("id").single();
  if (error || !data) return { ok: false, erro: error?.code === "P0001" ? MSG_LIMITE_RESPOSTAS : "Não foi possível salvar a resposta." };
  revalidatePath(ROTA);
  return { ok: true, valor: { id: data.id as string } };
}

export async function apagarResposta(id: string): Promise<Res> {
  const s = await sessao();
  if (!s || !UUID.test(String(id))) return { ok: false, erro: "Resposta inválida." };
  await s.admin.from("respostas_rapidas").delete().eq("id", id).eq("owner_id", s.userId);
  revalidatePath(ROTA);
  return { ok: true, valor: undefined };
}

/** As respostas da conversa de um imóvel do dono: a mensagem do anúncio (61-B) primeiro, depois as salvas. */
export async function respostasDaConversaDoImovel(propertyId: string): Promise<RespostaRapida[]> {
  const s = await sessao();
  if (!s || !UUID.test(String(propertyId))) return [];
  const { data: im } = await s.supabase.from("properties").select("owner_id, mensagem_para_pedido").eq("id", propertyId).maybeSingle();
  if (!im || im.owner_id !== s.userId) return [];
  return respostasDaConversa(await minhasRespostas(), im.mensagem_para_pedido as string | null);
}

// ── Mensagens programadas ──────────────────────────────────────────────────────────────────────────────────────

export interface PainelProgramadas {
  contratoId: string;
  ativo: boolean;
  datas: { entrada: string; saida: string } | null;
  slots: { quando: Quando; rotulo: string; modelo: string; enviarEm: string | null; linha: LinhaProgramada | null; historico: LinhaProgramada[] }[];
}

async function contratoDoDono(contratoId: string) {
  const s = await sessao();
  if (!s || !UUID.test(String(contratoId))) return null;
  const c = await contratoDaProgramada(s.admin, contratoId);
  if (!c || c.properties?.owner_id !== s.userId) return null;
  return { s, c };
}

export async function programadasDaEstadia(contratoId: string): Promise<PainelProgramadas | null> {
  const r = await contratoDoDono(contratoId);
  if (!r) return null;
  const { s, c } = r;
  const datas = datasDaEstadia(c.contrato_blocos ?? []);
  const { data } = await s.admin
    .from("mensagens_programadas")
    .select("id, contrato_id, owner_id, quando, texto, enviar_em, enviada_em, cancelada_em, motivo_cancelamento")
    .eq("contrato_id", contratoId)
    .order("criado_em", { ascending: false });
  const linhas = (data ?? []) as LinhaProgramada[];
  return {
    contratoId,
    ativo: c.status === "ativo",
    datas,
    slots: QUANDOS.map((q) => ({
      quando: q,
      rotulo: MODELOS[q].rotulo,
      modelo: MODELOS[q].texto,
      enviarEm: datas ? enviarEm(q, datas).toISOString() : null,
      linha: linhas.find((l) => l.quando === q && !l.cancelada_em) ?? null,
      historico: linhas.filter((l) => l.quando === q && l.cancelada_em).slice(0, 3),
    })),
  };
}

export async function programarMensagem(contratoId: string, quando: string, texto: string): Promise<Res> {
  const r = await contratoDoDono(contratoId);
  if (!r) return { ok: false, erro: "Estadia não encontrada." };
  const { s, c } = r;
  if (c.status !== "ativo") return { ok: false, erro: "Esta estadia já foi encerrada." };
  if (!ehQuando(quando)) return { ok: false, erro: "Modelo inválido." };
  const t = (texto ?? "").trim();
  if (!t) return { ok: false, erro: "Escreva o texto da mensagem." };
  if (t.length > TEXTO_MAX) return { ok: false, erro: `Texto com até ${TEXTO_MAX} caracteres.` };
  if (temContato(t)) return { ok: false, erro: MSG_CONTATO_BLOQUEADO };
  const datas = datasDaEstadia(c.contrato_blocos ?? []);
  if (!datas) return { ok: false, erro: "A estadia ainda não tem datas." };
  const quandoSai = enviarEm(quando, datas);
  const { data: atual } = await s.admin.from("mensagens_programadas").select("id, enviada_em").eq("contrato_id", contratoId).eq("quando", quando).is("cancelada_em", null).maybeSingle();
  if (atual?.enviada_em) return { ok: false, erro: "Esta mensagem já foi enviada." };
  if (!atual && quandoSai.getTime() < Date.now()) return { ok: false, erro: "A data desta mensagem já passou." };
  const agora = new Date().toISOString();
  const { error } = atual
    ? await s.admin.from("mensagens_programadas").update({ texto: t, enviar_em: quandoSai.toISOString(), atualizado_em: agora }).eq("id", atual.id).is("enviada_em", null)
    : await s.admin.from("mensagens_programadas").insert({ contrato_id: contratoId, owner_id: s.userId, quando, texto: t, enviar_em: quandoSai.toISOString() });
  if (error) return { ok: false, erro: error.code === "23505" ? "Esta mensagem já está programada." : "Não foi possível programar a mensagem." };
  revalidatePath(`${HREF_ESTADIA(contratoId)}/mensagens`);
  return { ok: true, valor: undefined };
}

export async function cancelarMensagemProgramada(contratoId: string, quando: string): Promise<Res> {
  const r = await contratoDoDono(contratoId);
  if (!r || !ehQuando(quando)) return { ok: false, erro: "Mensagem não encontrada." };
  const { data } = await r.s.admin
    .from("mensagens_programadas")
    .update({ cancelada_em: new Date().toISOString(), motivo_cancelamento: "dono", atualizado_em: new Date().toISOString() })
    .eq("contrato_id", contratoId)
    .eq("quando", quando)
    .is("enviada_em", null)
    .is("cancelada_em", null)
    .select("id");
  if (!data?.length) return { ok: false, erro: "Nada para cancelar (já enviada ou cancelada)." };
  revalidatePath(`${HREF_ESTADIA(contratoId)}/mensagens`);
  return { ok: true, valor: undefined };
}
