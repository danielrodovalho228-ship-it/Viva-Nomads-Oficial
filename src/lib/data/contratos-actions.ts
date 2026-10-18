"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitirDoPagamento } from "@/lib/fiscal/emitir";
import { listMyProperties } from "@/lib/data/properties";
import { erroBancoPT } from "@/lib/erros-banco";
import { etapaContrato, type EtapaContrato } from "@/lib/contrato-etapas";
import { podeAvaliarLocacao } from "@/lib/contrato-assinar";

/**
 * Contratos & blocos do PROPRIETÁRIO + registro DECLARATÓRIO de pagamento
 * (Dashboard Fase 4).
 *
 * REGRA DE OURO: a plataforma NÃO movimenta dinheiro. Aqui o proprietário só
 * DOCUMENTA que recebeu o aluguel (direto do inquilino, fora da plataforma) e o
 * inquilino confirma. Nada é capturado — o registro vira histórico do contrato
 * (base do futuro dossiê). Nenhuma integração de pagamento.
 */

type ActionResult = { ok: boolean; demo?: boolean; id?: string; error?: string };

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
  blocoId: string;
  tipo: string;
  valor: number;
  forma: string;
  dataPagamento: string;
  confirmado: boolean;
  observacao: string | null;
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

function toPagamento(p: Record<string, unknown>): PagamentoView {
  return {
    id: String(p.id),
    blocoId: String(p.bloco_id),
    tipo: String(p.tipo ?? "aluguel"),
    valor: Number(p.valor),
    forma: String(p.forma ?? "pix"),
    dataPagamento: String(p.data_pagamento),
    confirmado: Boolean(p.confirmado_pelo_inquilino),
    observacao: (p.observacao as string | null) ?? null,
  };
}

/** 1º pagamento do aluguel declarado pelo proprietário E confirmado pelo inquilino. */
function primeiroPagamentoConfirmado(pagamentos: PagamentoView[]): boolean {
  return pagamentos.some((p) => p.tipo === "aluguel" && p.confirmado);
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
  criadoEm: string;
  /** Janela de avaliação aberta (contrato encerrado há até 14 dias). Nunca em contrato aguardando assinatura. */
  podeAvaliar: boolean;
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
    .select("id, property_id, aluguel_mensal, status, created_at, encerrado_em, assinado_proprietario_em, assinado_inquilino_em, properties(title, owner_id), pagamentos_bloco(*)")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });

  return ((data ?? []) as Record<string, unknown>[]).map((c) => {
    const prop = (c.properties as { title?: string; owner_id?: string } | null) ?? {};
    const pagamentos = ((c.pagamentos_bloco as Record<string, unknown>[]) ?? []).map(toPagamento);
    return {
      id: String(c.id),
      propertyId: String(c.property_id),
      propertyTitle: prop.title ?? "Imóvel",
      ownerId: String(prop.owner_id ?? ""),
      aluguelMensal: Number(c.aluguel_mensal),
      status: String(c.status ?? "ativo"),
      etapa: etapaContrato({
        assinadoProprietarioEm: c.assinado_proprietario_em as string | null,
        assinadoInquilinoEm: c.assinado_inquilino_em as string | null,
        primeiroPagamentoConfirmado: primeiroPagamentoConfirmado(pagamentos),
      }),
      criadoEm: String(c.created_at),
      podeAvaliar: podeAvaliarLocacao(String(c.status ?? "ativo"), (c.encerrado_em as string | null) ?? null),
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

  const { data } = await supabase
    .from("contratos")
    .select("*, contrato_blocos(*), pagamentos_bloco(*)")
    .in("property_id", ids)
    .order("created_at", { ascending: false });

  const contratos = (data ?? []) as Record<string, unknown>[];
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
    const pagamentos = ((c.pagamentos_bloco as Record<string, unknown>[]) ?? []).map(toPagamento);
    return {
      id: String(c.id),
      propertyId: String(c.property_id),
      propertyTitle: meta?.title ?? "Imóvel",
      tenantId: String(c.tenant_id ?? ""),
      city: meta?.city ?? "",
      aluguelMensal: Number(c.aluguel_mensal),
      prazoTotalDias: Number(c.prazo_total_dias),
      tamanhoBlocoMeses: Number(c.tamanho_bloco_meses ?? 2),
      comissaoValor: Number(c.comissao_valor ?? 0),
      comissaoPercent: Number(c.comissao_percent ?? 0),
      aceiteEm: aceiteDoLead.get(String(c.lead_id)) ?? null,
      qtdOcupantes: Number(c.qtd_ocupantes ?? 1),
      status: String(c.status ?? "ativo"),
      etapa: etapaContrato({
        assinadoProprietarioEm: c.assinado_proprietario_em as string | null,
        assinadoInquilinoEm: c.assinado_inquilino_em as string | null,
        primeiroPagamentoConfirmado: primeiroPagamentoConfirmado(pagamentos),
      }),
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
  if (!UUID_RE.test(input.blocoId) || !UUID_RE.test(input.contratoId))
    return { ok: true, demo: true };
  if (!(input.valor >= 0)) return { ok: false, error: "Informe um valor válido." };
  if (!input.dataPagamento) return { ok: false, error: "Informe a data do pagamento." };

  const { data, error } = await supabase
    .from("pagamentos_bloco")
    .insert({
      bloco_id: input.blocoId,
      contrato_id: input.contratoId,
      tipo: input.tipo ?? "aluguel",
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
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true, id: data?.id };
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
  after(() => emitirDoPagamento(pagamentoId));
  return { ok: true, id: pagamentoId };
}
