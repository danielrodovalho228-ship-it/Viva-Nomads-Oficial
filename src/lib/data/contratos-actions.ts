"use server";

import { after } from "next/server";
import { numeroPublicoContrato } from "@/lib/contrato-ref";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitirDoPagamentoComRegistro } from "@/lib/fiscal/emitir";
import { listMyProperties } from "@/lib/data/properties";
import { erroBancoPT } from "@/lib/erros-banco";
import { taxaDosContratosDoDono } from "@/lib/data/taxa-dono-servidor";
import type { EtapaContrato } from "@/lib/contrato-etapas";
import { estadoDoContratoUnico, type ChaveEstado, type EstadoContrato, type LinhaEstadoContrato } from "@/lib/contrato-estado";
import { podeAvaliarLocacao } from "@/lib/contrato-assinar";
import { rotuloPagamentoBloco } from "@/lib/pagamento-bloco";

/**
 * Contratos & blocos do PROPRIETÁRIO + registro DECLARATÓRIO de pagamento
 * (Dashboard Fase 4).
 *
 * REGRA DE OURO: a plataforma NÃO movimenta dinheiro. Aqui o proprietário só
 * DOCUMENTA que recebeu o aluguel (direto do inquilino, fora da plataforma) e o
 * inquilino confirma. Nada é capturado — o registro vira histórico do contrato
 * (base do futuro dossiê). Nenhuma integração de pagamento.
 */

type ActionResult = { ok: boolean; demo?: boolean; id?: string; error?: string; jaRegistrado?: boolean; mensagem?: string };
/** Segundo envio do mesmo recebimento (0182): devolve o que já existe, sem erro técnico. */
const MSG_JA_REGISTRADO = "Este recebimento já foi registrado";

/** Colunas de `contratos` que as partes leem pela sessão (sem a taxa — 0177). */
const COLUNAS_CONTRATO_PARTES =
  "id, property_id, tenant_id, lead_id, status, aluguel_mensal, prazo_total_dias, tamanho_bloco_meses, qtd_ocupantes, created_at, assinado_proprietario_em, assinado_inquilino_em";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BlocoView {
  id: string;
  numeroBloco: number;
  inicio: string;
  fim: string;
  meses: number;
  valor: number;
  caucao: number;
  caucaoForma: string;
  caucaoStatus: string;
  status: string;
}

export interface PagamentoView {
  id: string;
  /** null na Caução: ela é do contrato, não do bloco (0182). */
  blocoId: string | null;
  tipo: string;
  valor: number;
  forma: string;
  dataPagamento: string;
  confirmado: boolean;
  observacao: string | null;
  /** Rótulo único: "Bloco 1 (2 meses: 19/10 a 18/12) — R$ 6.400 (2 × R$ 3.200)" (jornada de assinatura, 19/10). */
  rotulo: string;
}

export interface ContratoView {
  id: string;
  propertyId: string;
  propertyTitle: string;
  tenantId: string;
  city: string;
  aluguelMensal: number;
  prazoTotalDias: number;
  tamanhoBlocoMeses: number;
  comissaoValor: number; // taxa × valor total (aluguel × meses), UMA vez (snapshot no fechamento)
  comissaoPercent: number; // 0..1 — taxa aplicada (para exibir "X% do valor total")
  /** Prompt 23: data do aceite da candidatura (a base da taxa segue a regra vigente nesse dia). */
  aceiteEm?: string | null;
  qtdOcupantes: number;
  status: string;
  /** F33: etapa real (assinatura → 1º pagamento → vigência); só vale com status "ativo". */
  etapa: EtapaContrato;
  /** Estado da fonte única (selo igual ao do detalhe e da carteira), visão do proprietário. */
  estado: EstadoContrato;
  criadoEm: string;
  blocos: BlocoView[];
  pagamentos: PagamentoView[];
}

function toBloco(b: Record<string, unknown>): BlocoView {
  return {
    id: String(b.id),
    numeroBloco: Number(b.numero_bloco),
    inicio: String(b.inicio),
    fim: String(b.fim),
    meses: Number(b.meses),
    valor: Number(b.valor),
    caucao: Number(b.caucao),
    caucaoForma: String(b.caucao_forma ?? "avista"),
    caucaoStatus: String(b.caucao_status ?? "pendente"),
    status: String(b.status ?? "agendado"),
  };
}

function toPagamento(p: Record<string, unknown>, valorMensal?: number | null): PagamentoView {
  const b = p.contrato_blocos as { numero_bloco?: number | null; meses?: number | null; inicio?: string | null; fim?: string | null } | null | undefined;
  return {
    rotulo: rotuloPagamentoBloco({
      tipo: String(p.tipo ?? "aluguel"),
      valor: Number(p.valor),
      bloco: b?.numero_bloco ? { numero: Number(b.numero_bloco), meses: Number(b.meses ?? 1), inicio: b.inicio ?? null, fim: b.fim ?? null } : null,
      valorMensal: valorMensal ?? null,
    }),
    id: String(p.id),
    blocoId: p.bloco_id ? String(p.bloco_id) : null,
    tipo: String(p.tipo ?? "aluguel"),
    valor: Number(p.valor),
    forma: String(p.forma ?? "pix"),
    dataPagamento: String(p.data_pagamento),
    confirmado: Boolean(p.confirmado_pelo_inquilino),
    observacao: (p.observacao as string | null) ?? null,
  };
}

/** Estado pela fonte única, a partir da linha do banco (com pagamentos_bloco). */
function estadoDaLinha(c: Record<string, unknown>, papel: "inquilino" | "proprietario"): EstadoContrato {
  return estadoDoContratoUnico(c as LinhaEstadoContrato, papel);
}

/** Prompt 28: estado REAL de um contrato (o RLS deixa as duas partes lerem), para o Resumo do fechamento. */
export interface EstadoContratoView {
  id: string;
  chave: ChaveEstado;
  texto: string;
  /** Ainda falta alguma assinatura. */
  assinando: boolean;
  criadoEm: string;
}

export async function lerEstadoDoContrato(contratoId: string, papel: "inquilino" | "proprietario"): Promise<EstadoContratoView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(String(contratoId))) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("contratos")
    .select("id, status, created_at, assinado_proprietario_em, assinado_inquilino_em, pagamentos_bloco(*)")
    .eq("id", contratoId)
    .maybeSingle();
  if (!data) return null;
  const e = estadoDaLinha(data as Record<string, unknown>, papel);
  return { id: String(data.id), chave: e.chave, texto: e.selo, assinando: e.etapa === "aguardando_assinatura", criadoEm: String(data.created_at) };
}

/** Contrato do INQUILINO (prompt 28): a seção "Contratos" — aguardando assinatura ainda não é locação. */
export interface ContratoInquilinoView {
  id: string;
  numero: string;
  propertyTitle: string;
  aluguelMensal: number;
  chave: ChaveEstado;
  texto: string;
  faltaVoce: boolean;
  assinando: boolean;
  criadoEm: string;
}

export async function getContratosDoInquilino(): Promise<ContratoInquilinoView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("contratos")
    .select("id, status, aluguel_mensal, created_at, assinado_proprietario_em, assinado_inquilino_em, properties(title), pagamentos_bloco(*)")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((c) => {
    const e = estadoDaLinha(c, "inquilino");
    return {
      id: String(c.id),
      numero: numeroPublicoContrato(String(c.id)),
      propertyTitle: (c.properties as { title?: string } | null)?.title ?? "Imóvel",
      aluguelMensal: Number(c.aluguel_mensal),
      chave: e.chave,
      texto: e.selo,
      faltaVoce: e.faltaVoce,
      assinando: e.etapa === "aguardando_assinatura",
      criadoEm: String(c.created_at),
    };
  });
}

/** Quantos contratos esperam a assinatura do inquilino (o número no menu "Contratos"). */
export async function contarContratosParaAssinar(): Promise<number> {
  return (await getContratosDoInquilino()).filter((c) => c.faltaVoce).length;
}

/** Locação do INQUILINO (visão simplificada) para avaliar o proprietário. */
export interface LocacaoView {
  id: string; // contrato_id
  propertyId: string;
  propertyTitle: string;
  ownerId: string;
  aluguelMensal: number;
  status: string;
  etapa: EtapaContrato;
  /** Estado da fonte única, visão do inquilino. */
  estado: EstadoContrato;
  criadoEm: string;
  /** Janela de avaliação aberta (contrato encerrado há até 14 dias). Nunca em contrato aguardando assinatura. */
  podeAvaliar: boolean;
  /** Fim do contrato (dá o prazo da avaliação, Prompt 43). */
  encerradoEm: string | null;
  /** Pagamentos registrados pelo proprietário (o inquilino confirma → recibo). */
  pagamentos: PagamentoView[];
}

/**
 * Minhas locações (visão do INQUILINO): contratos onde tenant_id = eu, com o
 * proprietário do imóvel (para avaliar). Best-effort: [] em demo/sem sessão.
 */
export async function getMinhasLocacoes(): Promise<LocacaoView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("contratos")
    .select("id, property_id, aluguel_mensal, status, created_at, encerrado_em, assinado_proprietario_em, assinado_inquilino_em, properties(title, owner_id), pagamentos_bloco(*, contrato_blocos(numero_bloco, meses, inicio, fim))")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });

  return ((data ?? []) as Record<string, unknown>[]).map((c) => {
    const prop = (c.properties as { title?: string; owner_id?: string } | null) ?? {};
    const pagamentos = ((c.pagamentos_bloco as Record<string, unknown>[]) ?? []).filter((pg) => !pg.anulado_em).map((pg) => toPagamento(pg, Number(c.aluguel_mensal)));
    const estado = estadoDaLinha(c, "inquilino");
    return {
      id: String(c.id),
      propertyId: String(c.property_id),
      propertyTitle: prop.title ?? "Imóvel",
      ownerId: String(prop.owner_id ?? ""),
      aluguelMensal: Number(c.aluguel_mensal),
      status: String(c.status ?? "ativo"),
      etapa: estado.etapa ?? "em_vigencia",
      estado,
      criadoEm: String(c.created_at),
      podeAvaliar: podeAvaliarLocacao(String(c.status ?? "ativo"), (c.encerrado_em as string | null) ?? null),
      encerradoEm: (c.encerrado_em as string | null) ?? null,
      pagamentos,
    };
  });
}

/**
 * Contratos do proprietário (contrato-mãe + blocos + pagamentos declarados).
 * Filtra pelos imóveis DELE (a RLS também restringe às partes do contrato).
 * Roda a checagem lazy do ciclo de blocos antes de listar. Best-effort: [] em
 * demo/sem sessão.
 */
export async function getMeusContratos(): Promise<ContratoView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Avança o ciclo de blocos (encerramento por não-renovação etc.) — o pg_cron
  // cobre quando ninguém abre o painel. Best-effort.
  try {
    await createAdminClient()?.rpc("avancar_ciclo_blocos"); // só o servidor executa (0070)
  } catch {
    /* best-effort */
  }

  const props = await listMyProperties();
  const ids = props.map((p) => p.id).filter((id) => UUID_RE.test(id));
  if (ids.length === 0) return [];
  const titleById = new Map(props.map((p) => [p.id, { title: p.title, city: p.city }]));

  // Lista fechada de colunas: a taxa (comissao_*) não sai mais pela API (0177) e vem do servidor logo abaixo.
  const { data } = await supabase
    .from("contratos")
    .select(`${COLUNAS_CONTRATO_PARTES}, contrato_blocos(*), pagamentos_bloco(*, contrato_blocos(numero_bloco, meses, inicio, fim))`)
    .in("property_id", ids)
    .order("created_at", { ascending: false });

  const contratos = (data ?? []) as unknown as Record<string, unknown>[];
  // A taxa de cada contrato, lida com o cliente de serviço só para imóveis DESTE dono.
  const admin = createAdminClient();
  const taxas = admin ? await taxaDosContratosDoDono(admin, user.id, contratos.map((c) => String(c.id))) : new Map();
  // Data do aceite de cada candidatura (o RLS deixa o dono ler as próprias).
  const leadIds = [...new Set(contratos.map((c) => c.lead_id).filter((x): x is string => typeof x === "string"))];
  const { data: leads } = leadIds.length
    ? await supabase.from("leads").select("id, accepted_at").in("id", leadIds)
    : { data: [] as { id: string; accepted_at: string | null }[] };
  const aceiteDoLead = new Map(((leads ?? []) as { id: string; accepted_at: string | null }[]).map((l) => [l.id, l.accepted_at]));
  return contratos.map((c) => {
    const meta = titleById.get(String(c.property_id));
    const blocos = ((c.contrato_blocos as Record<string, unknown>[]) ?? [])
      .map(toBloco)
      .sort((a, b) => a.numeroBloco - b.numeroBloco);
    const pagamentos = ((c.pagamentos_bloco as Record<string, unknown>[]) ?? []).filter((pg) => !pg.anulado_em).map((pg) => toPagamento(pg, Number(c.aluguel_mensal)));
    const estado = estadoDaLinha(c, "proprietario");
    return {
      id: String(c.id),
      propertyId: String(c.property_id),
      propertyTitle: meta?.title ?? "Imóvel",
      tenantId: String(c.tenant_id ?? ""),
      city: meta?.city ?? "",
      aluguelMensal: Number(c.aluguel_mensal),
      prazoTotalDias: Number(c.prazo_total_dias),
      tamanhoBlocoMeses: Number(c.tamanho_bloco_meses ?? 2),
      comissaoValor: taxas.get(String(c.id))?.comissaoValor ?? 0,
      comissaoPercent: taxas.get(String(c.id))?.comissaoPercent ?? 0,
      aceiteEm: aceiteDoLead.get(String(c.lead_id)) ?? null,
      qtdOcupantes: Number(c.qtd_ocupantes ?? 1),
      status: String(c.status ?? "ativo"),
      etapa: estado.etapa ?? "em_vigencia",
      estado,
      criadoEm: String(c.created_at),
      blocos,
      pagamentos,
    };
  });
}

export interface PagamentoInput {
  blocoId: string;
  contratoId: string;
  tipo?: "aluguel" | "caucao";
  valor: number;
  forma?: "pix" | "boleto" | "transferencia" | "dinheiro" | "outro";
  dataPagamento: string; // ISO yyyy-mm-dd
  observacao?: string;
  /** Encargos pagos junto (condomínio, IPTU, contas) — vão para o recibo. */
  encargos?: { rotulo: string; valor: number }[];
}

/**
 * O PROPRIETÁRIO registra que recebeu um pagamento (declaratório). NÃO há
 * captura de valores — só se documenta a data e a forma. A RLS garante que só
 * o dono do imóvel do contrato consegue inserir (marcado_por = ele).
 * Best-effort: no-op em demo/sem sessão/ids não-UUID (exemplos).
 */
export async function marcarPagamentoRecebido(input: PagamentoInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para registrar o recebimento." };
  // Exemplos (ids não-UUID) são só demonstração. A Caução não tem bloco (0182): só o contrato precisa ser real.
  if (!UUID_RE.test(input.contratoId) || ((input.tipo ?? "aluguel") === "aluguel" && !UUID_RE.test(input.blocoId)))
    return { ok: true, demo: true };
  if (!(input.valor >= 0)) return { ok: false, error: "Informe um valor válido." };
  if (!input.dataPagamento) return { ok: false, error: "Informe a data do pagamento." };

  const tipo = input.tipo ?? "aluguel";
  // Caução é do CONTRATO (0182): grava sem bloco. O valor mensal é de um bloco.
  const { data, error } = await supabase
    .from("pagamentos_bloco")
    .insert({
      bloco_id: tipo === "caucao" ? null : input.blocoId,
      contrato_id: input.contratoId,
      tipo,
      valor: input.valor,
      forma: input.forma ?? "pix",
      data_pagamento: input.dataPagamento,
      marcado_por: user.id,
      observacao: input.observacao?.trim() || null,
      encargos: (input.encargos ?? [])
        .filter((e) => e.rotulo?.trim() && Number(e.valor) > 0)
        .slice(0, 8)
        .map((e) => ({ rotulo: e.rotulo.trim().slice(0, 60), valor: Math.round(Number(e.valor) * 100) / 100 })),
    })
    .select("id")
    .single();
  if (error) {
    // Clique duplo ou segundo envio: o índice único (uma Caução por contrato, um valor mensal por bloco) recusa e
    // devolvemos o registro que já existe, sem erro técnico.
    if (error.code === "23505") {
      const existente = await pagamentoJaRegistrado(supabase, input.contratoId, tipo, input.blocoId);
      return { ok: true, id: existente ?? undefined, jaRegistrado: true, mensagem: MSG_JA_REGISTRADO };
    }
    return { ok: false, error: erroBancoPT(error) };
  }
  return { ok: true, id: data?.id };
}

async function pagamentoJaRegistrado(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  contratoId: string,
  tipo: "aluguel" | "caucao",
  blocoId: string
): Promise<string | null> {
  let q = supabase.from("pagamentos_bloco").select("id").eq("contrato_id", contratoId).eq("tipo", tipo).is("anulado_em", null);
  if (tipo === "aluguel") q = q.eq("bloco_id", blocoId);
  const { data } = await q.order("created_at", { ascending: true }).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * O INQUILINO confirma um pagamento declarado pelo proprietário. A RLS garante
 * que só o inquilino do contrato consegue atualizar. Best-effort.
 */
export async function confirmarPagamento(pagamentoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para confirmar." };
  if (!UUID_RE.test(pagamentoId)) return { ok: true, demo: true };

  const { error } = await supabase
    .from("pagamentos_bloco")
    // confirmado_em é carimbado pelo banco (0057: o inquilino só grava a confirmação).
    .update({ confirmado_pelo_inquilino: true })
    .eq("id", pagamentoId);
  if (error) return { ok: false, error: erroBancoPT(error) };
  // Registrado pelo dono + confirmado pelo inquilino → recibo (ou comprovante da
  // caução) em PDF, por e-mail às duas partes. Depois da resposta: não atrasa a tela.
  after(() => emitirDoPagamentoComRegistro(pagamentoId));
  return { ok: true, id: pagamentoId };
}
