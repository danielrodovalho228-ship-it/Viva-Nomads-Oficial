"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, HORA } from "@/lib/limites";
import { CAUCAO_PRAZOS_ATIVA } from "@/lib/flags";
import { contratoTemCaucao, descontoValido } from "./prazos";
import { caminhoDeComprovanteValido, podeContestar, podeDarParecer } from "./acoes-regras";

/*
  E637 (b) — as três ações da caução. TODAS atrás da chave CAUCAO_PRAZOS_ATIVA (desligada até o parecer da Dra. Beatriz).
  O servidor confere quem é a pessoa (dono ou morador do contrato) e exige a prova DE NOVO: fotos de entrada e de saída que
  pertencem às conferências do próprio contrato + comprovante na pasta de quem envia. A Viva não decide a disputa.
*/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Resultado = { ok: true } | { ok: false; error: string };
const erro = (error: string): Resultado => ({ ok: false, error });
const ERRO_DESLIGADA = "Esta função ainda não está disponível.";
/** E642: garantia única — contrato com seguro-fiança não tem caução. */
const ERRO_SEM_CAUCAO = "Este contrato usa seguro-fiança: não há caução a devolver.";
const hojeBr = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export interface ItemParecer {
  categoria: string;
  comodo: string;
  descricao?: string;
  valor: number;
  fotoEntrada: string;
  fotoSaida: string;
  comprovante: string;
}

async function contexto(contratoId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin || !UUID_RE.test(contratoId)) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: c } = await admin.from("contratos").select("id, tenant_id, garantia, properties(owner_id)").eq("id", contratoId).maybeSingle();
  if (!c) return null;
  const owner_id = (c.properties as unknown as { owner_id?: string } | null)?.owner_id;
  return { user, admin, tenant_id: c.tenant_id as string, owner_id, garantia: (c.garantia as string | null) ?? null };
}

/** As fotos do item precisam ser da conferência de entrada / de saída DESTE contrato. */
async function fotosSaoDoContrato(admin: NonNullable<ReturnType<typeof createAdminClient>>, contratoId: string, entrada: string, saida: string): Promise<boolean> {
  const { data } = await admin.from("conferencias").select("id, tipo").eq("contrato_id", contratoId);
  const conf = (data ?? []) as { id: string; tipo: string }[];
  const idEntrada = conf.find((c) => c.tipo === "entrada")?.id;
  const idSaida = conf.find((c) => c.tipo === "saida")?.id;
  if (!idEntrada || !idSaida) return false;
  const [{ data: a }, { data: b }] = await Promise.all([
    admin.from("conferencia_itens").select("id").eq("conferencia_id", idEntrada).eq("foto_path", entrada).limit(1),
    admin.from("conferencia_itens").select("id").eq("conferencia_id", idSaida).eq("foto_path", saida).limit(1),
  ]);
  return (a?.length ?? 0) > 0 && (b?.length ?? 0) > 0;
}

/** O dono dá o parecer UMA vez, até o dia 7. Sem itens = liberação integral; com itens, cada um com prova. */
export async function darParecerCaucao(contratoId: string, itens: ItemParecer[]): Promise<Resultado> {
  if (!CAUCAO_PRAZOS_ATIVA) return erro(ERRO_DESLIGADA);
  const ctx = await contexto(contratoId);
  if (!ctx) return erro("Contrato não encontrado.");
  if (!contratoTemCaucao(ctx.garantia)) return erro(ERRO_SEM_CAUCAO);
  const { user } = ctx;
  if (ctx.owner_id !== user.id) return erro("Só o proprietário dá o parecer da caução.");
  if (!(await consumirLimite(`caucao-parecer:${user.id}`, 20, HORA))) return erro("Muitas tentativas. Tente de novo em instantes.");
  if (!Array.isArray(itens) || itens.length > 20) return erro("Informe até 20 itens.");
  const { data: prazo } = await ctx.admin.from("caucao_prazos").select("saida_em, parecer_em").eq("contrato_id", contratoId).maybeSingle();
  if (!prazo) return erro("Os prazos deste contrato ainda não começaram.");
  const pode = podeDarParecer({ saida: prazo.saida_em as string, parecerEm: (prazo.parecer_em as string | null) ?? null, hoje: hojeBr() });
  if (!pode.ok) return erro(pode.motivo);
  for (const i of itens) {
    const v = descontoValido({ valor: Number(i.valor), categoria: i.categoria, comodo: i.comodo, fotoEntrada: i.fotoEntrada, fotoSaida: i.fotoSaida, comprovante: i.comprovante });
    if (!v.ok) return erro(v.motivo);
    if (!caminhoDeComprovanteValido(i.comprovante, user.id)) return erro("O comprovante precisa ser enviado por você, em PDF ou imagem.");
    if (!(await fotosSaoDoContrato(ctx.admin, contratoId, i.fotoEntrada, i.fotoSaida))) return erro("As fotos precisam ser da conferência de entrada e da de saída deste contrato.");
  }
  const agora = new Date().toISOString();
  if (itens.length) {
    const { error } = await ctx.admin.from("caucao_desconto_itens").insert(
      itens.map((i) => ({ contrato_id: contratoId, categoria: i.categoria, comodo: i.comodo.trim(), descricao: i.descricao?.slice(0, 600) ?? null, valor: Number(i.valor), foto_entrada_path: i.fotoEntrada, foto_saida_path: i.fotoSaida, comprovante_path: i.comprovante })),
    );
    if (error) return erro("Não foi possível registrar o parecer.");
  }
  const semDesconto = itens.length === 0;
  const { error: e2 } = await ctx.admin.from("caucao_prazos").update({
    parecer_em: agora,
    atualizado_em: agora,
    ...(semDesconto ? { liberacao_integral_em: agora, liberacao_motivo: "parecer_sem_desconto" } : {}),
  }).eq("contrato_id", contratoId).is("parecer_em", null);
  if (e2) return erro("Não foi possível registrar o parecer.");
  revalidatePath(`/dashboard/contratos/${contratoId}`);
  return { ok: true };
}

/** O morador contesta UM item, em até 5 dias do parecer. */
export async function contestarDescontoCaucao(itemId: string, texto: string): Promise<Resultado> {
  if (!CAUCAO_PRAZOS_ATIVA) return erro(ERRO_DESLIGADA);
  if (!UUID_RE.test(itemId)) return erro("Item inválido.");
  const motivo = (texto ?? "").trim();
  if (motivo.length < 5 || motivo.length > 600) return erro("Explique a contestação em até 600 caracteres.");
  const admin = createAdminClient();
  if (!admin) return erro("Serviço indisponível.");
  const { data: it } = await admin.from("caucao_desconto_itens").select("id, contrato_id, status").eq("id", itemId).maybeSingle();
  if (!it) return erro("Item não encontrado.");
  const ctx = await contexto(it.contrato_id as string);
  if (!ctx) return erro("Contrato não encontrado.");
  if (!contratoTemCaucao(ctx.garantia)) return erro(ERRO_SEM_CAUCAO);
  const { user } = ctx;
  if (ctx.tenant_id !== user.id) return erro("Só o morador contesta o desconto.");
  if (!(await consumirLimite(`caucao-contesta:${user.id}`, 30, HORA))) return erro("Muitas tentativas. Tente de novo em instantes.");
  const { data: prazo } = await admin.from("caucao_prazos").select("parecer_em").eq("contrato_id", it.contrato_id).maybeSingle();
  const pode = podeContestar({ parecerEm: (prazo?.parecer_em as string | null) ?? null, hoje: hojeBr(), item: { status: String(it.status) } });
  if (!pode.ok) return erro(pode.motivo);
  const { error } = await admin.from("caucao_desconto_itens").update({ status: "contestado", contestacao_texto: motivo, contestado_em: new Date().toISOString() }).eq("id", itemId).neq("status", "contestado");
  if (error) return erro("Não foi possível registrar a contestação.");
  revalidatePath(`/dashboard/estadia/${it.contrato_id}`);
  return { ok: true };
}

/** O dono declara a devolução feita: some a pendência e o bloqueio de anúncio novo. */
export async function registrarDevolucaoCaucao(contratoId: string): Promise<Resultado> {
  if (!CAUCAO_PRAZOS_ATIVA) return erro(ERRO_DESLIGADA);
  const ctx = await contexto(contratoId);
  if (!ctx) return erro("Contrato não encontrado.");
  if (!contratoTemCaucao(ctx.garantia)) return erro(ERRO_SEM_CAUCAO);
  const { user } = ctx;
  if (ctx.owner_id !== user.id) return erro("Só o proprietário registra a devolução.");
  if (!(await consumirLimite(`caucao-devolucao:${user.id}`, 20, HORA))) return erro("Muitas tentativas. Tente de novo em instantes.");
  const agora = new Date().toISOString();
  const { error } = await ctx.admin.from("caucao_prazos").update({ devolvida_em: agora, atualizado_em: agora }).eq("contrato_id", contratoId).is("devolvida_em", null);
  if (error) return erro("Não foi possível registrar a devolução.");
  revalidatePath("/dashboard/contratos");
  return { ok: true };
}
