"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitirTermoDevolucaoComRegistro } from "@/lib/fiscal/emitir";
import { ROTULO_TIPO, type TipoDocumento } from "@/lib/fiscal/documento";
import { regraDevolucao } from "@/lib/fiscal/devolucao";
import { componentesDoPagamento, parteDaColuna } from "@/lib/pagamento-componentes";
import { anulacaoDaLinha } from "@/lib/documentos-linha";

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
  /** E1250: anulado (0083/0182) pela DATA — o documento existiu e o PDF continua acessível, mas não vale mais. */
  anulada: boolean;
  /** E1250: o motivo, só para o texto do selo (null = sem motivo: o selo diz "Anulado"). */
  motivoAnulacao: string | null;
}

/** Pagamento confirmado pelo inquilino e o recibo dele (ou "em preparação" enquanto não sai). */
export interface ReciboView {
  pagamentoId: string;
  /** E1067 (fusão, ORDENS-DUET 1149 e 1194): a linha é o número, o TOTAL do registro e o período em datas. */
  tipo: string;
  /** O TOTAL do registro (valor + encargos), pela fonte única componentesDoPagamento — nunca só a coluna valor. */
  total: number;
  inicio: string | null;
  fim: string | null;
  /** E1233: o número do bloco (null no registro antigo, sem bloco) e a parte, lida da coluna (2+ = complementar). */
  bloco: number | null;
  parte: number;
  documentoId: string | null;
  numero: string | null;
  /** E1250: anulado pela DATA, no documento ou no pagamento (anulacaoDaLinha). */
  anulada: boolean;
  /** E1250: o motivo do lado com data (ex.: "registro em duplicidade"), só para o texto do selo; null = sem motivo. */
  motivoAnulacao: string | null;
  /** E1243: o número do chamado ABERTO que pede a anulação deste registro à Central (null = nenhum). */
  pedidoAnulacao?: string | null;
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
const NOTA_DO_PEDIDO = /^\[anulacao\] pagamento=([0-9a-f-]{36})$/i;
const CHAMADO_FECHADO = new Set(["resolvido", "encerrado"]);

/**
 * E1243: os chamados ABERTOS que pedem a anulação de um registro destes contratos (o contexto do contrato e a nota do
 * SISTEMA "[anulacao] pagamento=<id>", gravada na abertura do pedido) → pagamento → número do chamado. Só o servidor lê
 * as notas internas; os registros a que a linha se junta são os que a sessão da pessoa leu. Falha: nenhuma linha.
 */
async function pedidosDeAnulacaoAbertos(contratoIds: string[]): Promise<Map<string, string>> {
  const pedidos = new Map<string, string>();
  const admin = createAdminClient();
  if (!admin || contratoIds.length === 0) return pedidos;
  const { data: chs, error } = await admin.from("chamados").select("id, numero_publico, status, contexto_id").eq("contexto_tipo", "contrato").in("contexto_id", contratoIds);
  const abertos = ((chs ?? []) as { id: string; numero_publico: string; status: string }[]).filter((c) => !CHAMADO_FECHADO.has(String(c.status)));
  if (error || abertos.length === 0) return pedidos;
  const { data: notas, error: eNotas } = await admin
    .from("chamado_mensagens")
    .select("chamado_id, corpo")
    .in("chamado_id", abertos.map((c) => c.id))
    .eq("autor", "sistema")
    .eq("interno", true);
  if (eNotas) return pedidos;
  const numero = new Map(abertos.map((c) => [c.id, String(c.numero_publico)]));
  for (const n of (notas ?? []) as { chamado_id: string; corpo: string }[]) {
    const pg = NOTA_DO_PEDIDO.exec(String(n.corpo ?? "").trim())?.[1]?.toLowerCase();
    const num = numero.get(n.chamado_id);
    if (pg && num) pedidos.set(pg, num);
  }
  return pedidos;
}

/** E1250: a decisão (pela data) e o motivo do selo, nos dois campos das linhas. */
const anulacaoNaVista = (a: { anulada: boolean; motivo: string | null }) => ({ anulada: a.anulada, motivoAnulacao: a.motivo });

export async function documentosDosContratos(
  contratoIds: string[],
): Promise<Record<string, { documentos: DocumentoView[]; recibos: ReciboView[]; acerto: AcertoView | null; caucaoConfirmada: number; falhou?: true }>> {
  const supabase = await createClient();
  const ids = contratoIds.filter((id) => UUID_RE.test(id));
  const vazio = Object.fromEntries(ids.map((id) => [id, { documentos: [] as DocumentoView[], recibos: [] as ReciboView[], acerto: null as AcertoView | null, caucaoConfirmada: 0 }]));
  if (!supabase || ids.length === 0) return vazio;
  const [{ data: docs, error: eDocs }, { data: acertos, error: eAcertos }, { data: caucoes, error: eCaucoes }, { data: confirmados, error: eConfirmados }] = await Promise.all([
    supabase.from("documentos_fiscais").select("id, tipo, numero, valor, periodo_inicio, periodo_fim, criado_em, contrato_id, pagamento_id, anulado_em, anulado_motivo").in("contrato_id", ids).order("criado_em", { ascending: false }),
    supabase.from("caucao_acertos").select("id, contrato_id, caucao_total, valor_devolvido, data_devolucao, meio, status, created_at").in("contrato_id", ids).order("created_at", { ascending: false }),
    supabase.from("pagamentos_bloco").select("contrato_id, valor").in("contrato_id", ids).eq("tipo", "caucao").eq("confirmado_pelo_inquilino", true).is("anulado_em", null),
    supabase
      .from("pagamentos_bloco")
      .select("id, contrato_id, tipo, parte, valor, encargos, data_pagamento, anulado_em, anulado_motivo, contrato_blocos(numero_bloco, meses, inicio, fim)")
      .in("contrato_id", ids)
      .eq("confirmado_pelo_inquilino", true)
      .order("data_pagamento", { ascending: true }),
  ]);
  // Estados vazios: qualquer leitura que falhe marca o contrato — a tela avisa e não mostra "sem documentos", caução 0
  // nem o formulário da devolução como se nada tivesse sido registrado.
  if (eDocs || eAcertos || eCaucoes || eConfirmados) {
    return Object.fromEntries(ids.map((id) => [id, { ...vazio[id], falhou: true as const }]));
  }
  // Recibo de cada pagamento confirmado: o documento quando já saiu; senão "Recibo em preparação" (jornada de
  // assinatura, 19/10 — antes a tela prometia o envio e o recibo nunca saía).
  const docDoPagamento = new Map(((docs ?? []) as Record<string, unknown>[]).filter((d) => d.pagamento_id).map((d) => [String(d.pagamento_id), d]));
  for (const pg of (confirmados ?? []) as Record<string, unknown>[]) {
    const alvo = vazio[pg.contrato_id as string];
    if (!alvo) continue;
    const b = pg.contrato_blocos as { numero_bloco?: number | null; meses?: number | null; inicio?: string | null; fim?: string | null } | null;
    const doc = docDoPagamento.get(String(pg.id));
    alvo.recibos.push({
      pagamentoId: String(pg.id),
      tipo: String(pg.tipo ?? "aluguel"),
      total: componentesDoPagamento({ valor: Number(pg.valor), encargos: String(pg.tipo ?? "aluguel") === "caucao" ? [] : pg.encargos }).total,
      inicio: b?.inicio ?? null,
      fim: b?.fim ?? null,
      bloco: b?.numero_bloco ? Number(b.numero_bloco) : null,
      parte: parteDaColuna(pg.parte),
      documentoId: doc ? String(doc.id) : null,
      numero: doc ? String(doc.numero) : null,
      ...anulacaoNaVista(
        anulacaoDaLinha({
          documento: doc ? { anuladoEm: doc.anulado_em as string | null, motivo: doc.anulado_motivo as string | null } : null,
          pagamento: { anuladoEm: pg.anulado_em as string | null, motivo: pg.anulado_motivo as string | null },
        }),
      ),
    });
  }
  // E1243 (ORDENS-DUET 1213 e 1216): o pedido de anulação à Central continua visível enquanto o chamado está aberto.
  const pedidos = await pedidosDeAnulacaoAbertos(ids);
  for (const alvo of Object.values(vazio)) for (const r of alvo.recibos) r.pedidoAnulacao = pedidos.get(r.pagamentoId) ?? null;
  for (const d of docs ?? []) {
    const alvo = vazio[d.contrato_id as string];
    if (!alvo || d.pagamento_id) continue; // o recibo de um pagamento aparece na lista de recibos
    alvo.documentos.push({
      id: d.id as string,
      tipo: d.tipo as TipoDocumento,
      rotulo: ROTULO_TIPO[d.tipo as TipoDocumento] ?? String(d.tipo),
      numero: d.numero as string,
      valor: Number(d.valor),
      periodoInicio: (d.periodo_inicio as string) ?? null,
      periodoFim: (d.periodo_fim as string) ?? null,
      criadoEm: d.criado_em as string,
      ...anulacaoNaVista(anulacaoDaLinha({ documento: { anuladoEm: d.anulado_em as string | null, motivo: d.anulado_motivo as string | null } })),
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
  const [{ data: caucoes, error: erroCaucoes }, { data: abertos, error: erroAbertos }] = await Promise.all([
    admin.from("pagamentos_bloco").select("valor").eq("contrato_id", input.contratoId).eq("tipo", "caucao").eq("confirmado_pelo_inquilino", true).is("anulado_em", null),
    admin.from("caucao_acertos").select("id, status").eq("contrato_id", input.contratoId).in("status", ["aguardando_confirmacao", "devolvida_integral", "desconto_confirmado"]),
  ]);
  // Leitura falhou → nada é gravado: caução zerada ou um segundo acerto em aberto sairiam de uma lista vazia por erro.
  if (erroCaucoes || erroAbertos) return { ok: false, error: "Não foi possível registrar agora. Tente de novo." };
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
  const { data: a, error: erroAcerto } = await admin.from("caucao_acertos").select("id, contrato_id, tipo, status").eq("id", acertoId).maybeSingle();
  if (erroAcerto) return { ok: false, error: "Não foi possível registrar agora. Tente de novo." };
  if (!a) return { ok: false, error: "Devolução não encontrada." };
  const ctx = await papelNoContrato(a.contrato_id as string);
  if (!ctx || ctx.papel !== "inquilino") return { ok: false, error: "Só o inquilino confirma a devolução." };
  if (a.status !== "aguardando_confirmacao") return { ok: false, error: "Esta devolução já foi respondida." };
  const status = resposta === "contestar" ? "desconto_contestado" : a.tipo === "devolucao_integral" ? "devolvida_integral" : "desconto_confirmado";
  const { data: mudou, error } = await admin
    .from("caucao_acertos")
    .update({ status, confirmado_em: resposta === "confirmar" ? new Date().toISOString() : null })
    .eq("id", acertoId)
    .eq("status", "aguardando_confirmacao")
    .select("id");
  if (error) return { ok: false, error: "Não foi possível registrar agora." };
  // Duas respostas ao mesmo tempo: só a que mudou o status emite o termo (nunca dois termos da mesma devolução).
  if (!mudou?.length) return { ok: false, error: "Esta devolução já foi respondida." };
  if (resposta === "confirmar") after(() => emitirTermoDevolucaoComRegistro(acertoId));
  return { ok: true };
}
