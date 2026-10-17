"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { erroBancoPT } from "@/lib/erros-banco";
import { ehMotivoRevisao, validarContestacao, validarResposta } from "@/lib/avaliacoes-resposta";

type Resultado = { ok: boolean; error?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resposta pública do AVALIADO a uma avaliação publicada (0128). Grava com o
 * cliente da SESSÃO: a RLS e o gatilho conferem que quem responde é o avaliado,
 * que a avaliação está publicada e que o texto não tem contato nem ofensa. Uma por avaliação.
 */
export async function responderAvaliacao(avaliacaoId: string, texto: string): Promise<Resultado> {
  const err = validarResposta(texto);
  if (err) return { ok: false, error: err };
  if (!UUID_RE.test(avaliacaoId)) return { ok: false, error: "Avaliação inválida." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Sem conexão com o banco." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para responder." };
  const { error } = await supabase.from("avaliacao_respostas").insert({ avaliacao_id: avaliacaoId, texto: texto.trim() });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Você já respondeu a esta avaliação." };
    if (error.code === "42501") return { ok: false, error: "Só a pessoa avaliada responde." };
    return { ok: false, error: erroBancoPT(error, "Não foi possível publicar a resposta.") };
  }
  return { ok: true };
}

/** Pedido de revisão do AVALIADO: motivo objetivo + explicação; vai para a fila do /admin. */
export async function pedirRevisaoAvaliacao(avaliacaoId: string, motivo: string, detalhe: string): Promise<Resultado> {
  const err = validarContestacao(motivo, detalhe);
  if (err) return { ok: false, error: err };
  if (!UUID_RE.test(avaliacaoId)) return { ok: false, error: "Avaliação inválida." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Sem conexão com o banco." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para pedir revisão." };
  const { error } = await supabase
    .from("avaliacao_contestacoes")
    .insert({ avaliacao_id: avaliacaoId, motivo, detalhe: detalhe.trim() });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe um pedido de revisão aberto para esta avaliação." };
    if (error.code === "42501") return { ok: false, error: "Só a pessoa avaliada pede revisão." };
    return { ok: false, error: erroBancoPT(error, "Não foi possível enviar o pedido.") };
  }
  revalidatePath("/admin/avaliacoes");
  return { ok: true };
}

/**
 * Decisão do ADMIN (AAL2). "removida" tira a avaliação do ar — só vale se o
 * motivo objetivo do pedido se confirma; "mantida" encerra o pedido.
 */
export async function decidirRevisaoAvaliacao(contestacaoId: string, decisao: string, justificativa: string): Promise<Resultado> {
  if (!UUID_RE.test(contestacaoId)) return { ok: false, error: "Pedido inválido." };
  if (decisao !== "removida" && decisao !== "mantida") return { ok: false, error: "Decisão inválida." };
  const just = (justificativa ?? "").trim();
  if (just.length < 10 || just.length > 500) return { ok: false, error: "Explique a decisão (10 a 500 caracteres)." };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Sem conexão com o banco." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };
  const adm = createAdminClient();
  if (!adm) return { ok: false, error: "Sem conexão com o banco." };
  const { data: c } = await adm
    .from("avaliacao_contestacoes")
    .select("id, avaliacao_id, status, motivo")
    .eq("id", contestacaoId)
    .maybeSingle();
  if (!c || c.status !== "aberta" || !ehMotivoRevisao(c.motivo)) return { ok: false, error: "Pedido não está mais aberto." };
  const { error } = await adm
    .from("avaliacao_contestacoes")
    .update({ status: decisao, decisao: just, decidida_em: new Date().toISOString() })
    .eq("id", contestacaoId)
    .eq("status", "aberta");
  if (error) return { ok: false, error: "Não foi possível registrar a decisão." };
  if (decisao === "removida") {
    const { error: e2 } = await adm
      .from("avaliacoes")
      .update({ status: "removida", moderacao_motivo: `revisão: ${c.motivo}` })
      .eq("id", c.avaliacao_id as string);
    if (e2) return { ok: false, error: "Decisão gravada, mas a avaliação não saiu do ar. Tente de novo." };
  }
  revalidatePath("/admin/avaliacoes");
  return { ok: true };
}
