"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitirTermoDevolucao } from "@/lib/fiscal/emitir";
import { ROTULO_TIPO, type TipoDocumento } from "@/lib/fiscal/documento";
import { regraDevolucao } from "@/lib/fiscal/devolucao";

/**
 * Documentos do contrato (recibos, comprovante e termo da caução) e a
 * DEVOLUÇÃO DA CAUÇÃO: o proprietário registra quanto devolveu (fora da
 * plataforma — ela nunca movimenta o valor), o inquilino confirma, e só então
 * sai o termo de devolução. A escrita em caucao_acertos é só pelo servidor
 * (0074), com o papel de cada um conferido aqui.
 */

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DocumentoView {
  id: string;
  tipo: TipoDocumento;
  rotulo: string;
  numero: string;
  valor: number;
  periodoInicio: string | null;
  periodoFim: string | null;
  criadoEm: string;
}

export interface AcertoView {
  id: string;
  caucaoTotal: number;
  valorDevolvido: number;
  dataDevolucao: string | null;
  meio: string | null;
  status: string;
}

/** Documentos e acerto da caução de contratos em que a pessoa é parte (o RLS filtra). */
export async function documentosDosContratos(contratoIds: string[]): Promise<Record<string, { documentos: DocumentoView[]; acerto: AcertoView | null; caucaoConfirmada: number }>> {
  const supabase = await createClient();
  const ids = contratoIds.filter((id) => UUID_RE.test(id));
  const vazio = Object.fromEntries(ids.map((id) => [id, { documentos: [] as DocumentoView[], acerto: null as AcertoView | null, caucaoConfirmada: 0 }]));
  if (!supabase || ids.length === 0) return vazio;
  const [{ data: docs }, { data: acertos }, { data: caucoes }] = await Promise.all([
    supabase.from("documentos_fiscais").select("id, tipo, numero, valor, periodo_inicio, periodo_fim, criado_em, contrato_id").in("contrato_id", ids).order("criado_em", { ascending: false }),
    supabase.from("caucao_acertos").select("id, contrato_id, caucao_total, valor_devolvido, data_devolucao, meio, status, created_at").in("contrato_id", ids).order("created_at", { ascending: false }),
    supabase.from("pagamentos_bloco").select("contrato_id, valor").in("contrato_id", ids).eq("tipo", "caucao").eq("confirmado_pelo_inquilino", true),
  ]);
  for (const d of docs ?? []) {
    const alvo = vazio[d.contrato_id as string];
    if (!alvo) continue;
    alvo.documentos.push({
      id: d.id as string,
      tipo: d.tipo as TipoDocumento,
      rotulo: ROTULO_TIPO[d.tipo as TipoDocumento] ?? String(d.tipo),
      numero: d.numero as string,
      valor: Number(d.valor),
      periodoInicio: (d.periodo_inicio as string) ?? null,
      periodoFim: (d.periodo_fim as string) ?? null,
      criadoEm: d.criado_em as string,
    });
  }
  for (const a of acertos ?? []) {
    const alvo = vazio[a.contrato_id as string];
    if (!alvo || alvo.acerto) continue; // o mais recente
    alvo.acerto = {
      id: a.id as string,
      caucaoTotal: Number(a.caucao_total),
      valorDevolvido: Number(a.valor_devolvido ?? 0),
      dataDevolucao: (a.data_devolucao as string) ?? null,
      meio: (a.meio as string) ?? null,
      status: a.status as string,
    };
  }
  for (const c of caucoes ?? []) {
    const alvo = vazio[c.contrato_id as string];
    if (alvo) alvo.caucaoConfirmada = Math.round((alvo.caucaoConfirmada + Number(c.valor)) * 100) / 100;
  }
  return vazio;
}

/** Contrato + papel da pessoa (dono do imóvel ou inquilino). */
async function papelNoContrato(contratoId: string): Promise<{ admin: NonNullable<ReturnType<typeof createAdminClient>>; userId: string; papel: "dono" | "inquilino" | null; status: string } | null> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin || !UUID_RE.test(contratoId)) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: c } = await admin.from("contratos").select("id, status, tenant_id, properties!inner(owner_id)").eq("id", contratoId).maybeSingle();
  if (!c) return null;
  const dono = (c.properties as unknown as { owner_id: string }).owner_id;
  return { admin, userId: user.id, papel: dono === user.id ? "dono" : c.tenant_id === user.id ? "inquilino" : null, status: c.status as string };
}

/** O PROPRIETÁRIO registra a devolução da caução (fora da plataforma). */
export async function registrarDevolucaoCaucao(input: { contratoId: string; valorDevolvido: number; dataDevolucao: string; meio: string }): Promise<Res<{ id: string }>> {
  const ctx = await papelNoContrato(input.contratoId);
  if (!ctx) return { ok: false, error: "Contrato não encontrado." };
  if (ctx.papel !== "dono") return { ok: false, error: "Só o proprietário registra a devolução." };
  const { admin } = ctx;
  const [{ data: caucoes }, { data: abertos }] = await Promise.all([
    admin.from("pagamentos_bloco").select("valor").eq("contrato_id", input.contratoId).eq("tipo", "caucao").eq("confirmado_pelo_inquilino", true),
    admin.from("caucao_acertos").select("id, status").eq("contrato_id", input.contratoId).in("status", ["aguardando_confirmacao", "devolvida_integral", "desconto_confirmado"]),
  ]);
  const caucaoTotal = Math.round((caucoes ?? []).reduce((s, c) => s + Number(c.valor), 0) * 100) / 100;
  const regra = regraDevolucao({ statusContrato: ctx.status, caucaoTotal, valorDevolvido: input.valorDevolvido, dataDevolucao: input.dataDevolucao, meio: input.meio, jaTemAcerto: (abertos ?? []).length > 0 });
  if (!regra.ok) return { ok: false, error: regra.error };
  const { data, error } = await admin
    .from("caucao_acertos")
    .insert({
      contrato_id: input.contratoId,
      tipo: regra.tipo,
      caucao_total: caucaoTotal,
      valor_devolvido: regra.valor,
      data_devolucao: input.dataDevolucao,
      meio: input.meio,
      status: "aguardando_confirmacao",
      registrado_por: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível registrar agora." };
  return { ok: true, id: data.id as string };
}

/** O INQUILINO confirma (ou contesta) a devolução. Confirmada → termo em PDF às duas partes. */
export async function responderDevolucaoCaucao(acertoId: string, resposta: "confirmar" | "contestar"): Promise<Res> {
  const admin = createAdminClient();
  if (!admin || !UUID_RE.test(acertoId)) return { ok: false, error: "Devolução não encontrada." };
  const { data: a } = await admin.from("caucao_acertos").select("id, contrato_id, tipo, status").eq("id", acertoId).maybeSingle();
  if (!a) return { ok: false, error: "Devolução não encontrada." };
  const ctx = await papelNoContrato(a.contrato_id as string);
  if (!ctx || ctx.papel !== "inquilino") return { ok: false, error: "Só o inquilino confirma a devolução." };
  if (a.status !== "aguardando_confirmacao") return { ok: false, error: "Esta devolução já foi respondida." };
  const status = resposta === "contestar" ? "desconto_contestado" : a.tipo === "devolucao_integral" ? "devolvida_integral" : "desconto_confirmado";
  const { error } = await admin
    .from("caucao_acertos")
    .update({ status, confirmado_em: resposta === "confirmar" ? new Date().toISOString() : null })
    .eq("id", acertoId)
    .eq("status", "aguardando_confirmacao");
  if (error) return { ok: false, error: "Não foi possível registrar agora." };
  if (resposta === "confirmar") after(() => emitirTermoDevolucao(acertoId));
  return { ok: true };
}
