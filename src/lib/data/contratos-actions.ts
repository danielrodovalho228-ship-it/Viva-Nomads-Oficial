"use server";

import { createClient } from "@/lib/supabase/server";
import { listMyProperties } from "@/lib/data/properties";

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
  comissaoValor: number;
  qtdOcupantes: number;
  status: string;
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

/** Locação do INQUILINO (visão simplificada) para avaliar o proprietário. */
export interface LocacaoView {
  id: string; // contrato_id
  propertyId: string;
  propertyTitle: string;
  ownerId: string;
  aluguelMensal: number;
  status: string;
  criadoEm: string;
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
    .select("id, property_id, aluguel_mensal, status, created_at, properties(title, owner_id)")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });

  return ((data ?? []) as Record<string, unknown>[]).map((c) => {
    const prop = (c.properties as { title?: string; owner_id?: string } | null) ?? {};
    return {
      id: String(c.id),
      propertyId: String(c.property_id),
      propertyTitle: prop.title ?? "Imóvel",
      ownerId: String(prop.owner_id ?? ""),
      aluguelMensal: Number(c.aluguel_mensal),
      status: String(c.status ?? "ativo"),
      criadoEm: String(c.created_at),
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
    await supabase.rpc("avancar_ciclo_blocos");
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
      qtdOcupantes: Number(c.qtd_ocupantes ?? 1),
      status: String(c.status ?? "ativo"),
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
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
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
    .update({ confirmado_pelo_inquilino: true, confirmado_em: new Date().toISOString() })
    .eq("id", pagamentoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: pagamentoId };
}
