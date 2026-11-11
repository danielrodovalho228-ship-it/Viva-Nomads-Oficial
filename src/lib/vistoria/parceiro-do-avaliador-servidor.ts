import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugBase } from "@/lib/parceiros/regras";
import { CATEGORIA_AVALIADOR } from "./entrada";

type AdminClient = SupabaseClient;

/**
 * Ativa o parceiro do candidato a avaliador a partir da solicitação ligada (categoria "vistoria"), sem o link de
 * ativação por e-mail: a pessoa já está logada na própria conta e a aprovação é uma só.
 */
export async function ativarParceiroDoAvaliador(
  admin: AdminClient,
  userId: string,
  solicitacaoId: string | null,
  adminId: string | null,
  agora: string,
): Promise<{ ok: true; parceiroId: string } | { ok: false; erro: string }> {
  const { data: existente } = await admin.from("parceiros").select("id, categorias").eq("user_id", userId).maybeSingle();
  if (existente) {
    const categorias = [...new Set([...((existente.categorias as string[]) ?? []), CATEGORIA_AVALIADOR])];
    await admin.from("parceiros").update({ categorias }).eq("id", existente.id);
    return { ok: true, parceiroId: existente.id as string };
  }
  if (!solicitacaoId) return { ok: false, erro: "Pedido sem os dados de parceiro." };
  const { data: sol } = await admin.from("parceiro_solicitacoes").select("id, nome, tipo_pessoa, emite_nota, documento, cidades, descricao, telefone").eq("id", solicitacaoId).maybeSingle();
  if (!sol) return { ok: false, erro: "Pedido sem os dados de parceiro." };
  const base = slugBase(sol.nome as string);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base.slice(0, 54)}-${i + 1}`;
    const { data: p, error } = await admin
      .from("parceiros")
      .insert({
        user_id: userId,
        solicitacao_id: sol.id,
        tipo_pessoa: sol.tipo_pessoa,
        emite_nota: sol.tipo_pessoa === "pj" ? ((sol.emite_nota as boolean | null) ?? null) : null,
        documento: sol.documento,
        razao_social: sol.tipo_pessoa === "pj" ? sol.nome : null,
        nome_publico: String(sol.nome).slice(0, 80),
        slug,
        categorias: [CATEGORIA_AVALIADOR],
        cidades: sol.cidades,
        descricao: sol.descricao,
        telefone: sol.telefone,
        status: "rascunho",
      })
      .select("id")
      .single();
    if (!error && p) {
      await admin.from("parceiro_solicitacoes").update({ status: "ativada", decidido_por: adminId, decidido_em: agora, atualizado_em: agora }).eq("id", sol.id);
      return { ok: true, parceiroId: p.id as string };
    }
    if (error && (error.code !== "23505" || !/slug/.test(error.message))) {
      console.error("[ativarParceiroDoAvaliador]", error.code, error.message);
      return { ok: false, erro: "Não foi possível ativar o parceiro agora. Tente de novo." };
    }
  }
  return { ok: false, erro: "Não foi possível ativar o parceiro agora. Tente de novo." };
}

