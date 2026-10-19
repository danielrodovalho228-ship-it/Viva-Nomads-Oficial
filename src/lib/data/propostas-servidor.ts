import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularTotais, STATUS_ABERTOS, type Autor, type StatusProposta, type TermosProposta } from "@/lib/propostas/regras";

/*
  Propostas (prompt 17) — leitura no servidor, usada pelas ações, pelo fechamento e pela rotina de automações.
  Sem "use server": são funções internas (recebem o cliente admin), nunca chamadas do navegador.
*/

export const COLUNAS_VERSAO =
  "id, proposta_id, versao, autor, valor_base, desconto_pct, desconto_valor, motivo_desconto, desconto_estadia_pct, valor_mensal, meses, data_entrada, condominio, consumo, limpezas_mes, valor_limpeza, taxa_pet, limpeza_unica, pessoas, total_mensal, total_contrato, mensagem, criada_em";

export const COLUNAS_PROPOSTA =
  "id, numero, lead_id, property_id, owner_id, tenant_id, status, versao_atual, validade_dias, valida_ate, visto_em, recusada_por, recusa_motivo, recusa_texto, taxa_congelada, taxa_no_envio, aceita_em, criada_em, atualizada_em";

export interface LinhaProposta {
  id: string;
  numero: string;
  lead_id: string;
  property_id: string;
  owner_id: string;
  tenant_id: string;
  status: StatusProposta;
  versao_atual: number;
  validade_dias: number;
  valida_ate: string;
  visto_em: string | null;
  recusada_por: Autor | null;
  recusa_motivo: string | null;
  recusa_texto: string | null;
  taxa_congelada: number | null;
  /** Complemento do prompt 27, parte B: a faixa do dono no envio (a taxa nunca sobe depois). */
  taxa_no_envio: number | null;
  aceita_em: string | null;
  criada_em: string;
  atualizada_em: string;
}

export interface LinhaVersao {
  id: string;
  proposta_id: string;
  versao: number;
  autor: Autor;
  valor_base: number;
  desconto_pct: number;
  desconto_valor: number;
  motivo_desconto: string | null;
  desconto_estadia_pct: number;
  valor_mensal: number;
  meses: number;
  data_entrada: string;
  condominio: number;
  consumo: number;
  limpezas_mes: number;
  valor_limpeza: number;
  taxa_pet: number;
  limpeza_unica: number;
  pessoas: number | null;
  total_mensal: number;
  total_contrato: number;
  mensagem: string | null;
  criada_em: string;
}

export function termosDaLinha(v: LinhaVersao): TermosProposta {
  return {
    valorBase: Number(v.valor_base),
    descontoPct: Number(v.desconto_pct),
    descontoValor: Number(v.desconto_valor),
    motivoDesconto: v.motivo_desconto,
    descontoEstadiaPct: Number(v.desconto_estadia_pct),
    meses: Number(v.meses),
    dataEntrada: String(v.data_entrada).slice(0, 10),
    condominio: Number(v.condominio),
    consumo: Number(v.consumo),
    limpezasMes: Number(v.limpezas_mes),
    valorLimpeza: Number(v.valor_limpeza),
    taxaPet: Number(v.taxa_pet),
    limpezaUnica: Number(v.limpeza_unica),
  };
}

/** Linha a gravar de uma versão (os totais são SEMPRE recalculados aqui, nunca vêm do navegador). */
export function linhaDaVersao(propostaId: string, versao: number, autor: Autor, t: TermosProposta, pessoas: number | null, mensagem: string | null) {
  const tot = calcularTotais(t);
  return {
    proposta_id: propostaId,
    versao,
    autor,
    valor_base: t.valorBase,
    desconto_pct: t.descontoPct,
    desconto_valor: t.descontoValor,
    motivo_desconto: t.motivoDesconto,
    desconto_estadia_pct: t.descontoEstadiaPct,
    valor_mensal: tot.valorMensal,
    meses: t.meses,
    data_entrada: t.dataEntrada,
    condominio: t.condominio,
    consumo: t.consumo,
    limpezas_mes: t.limpezasMes,
    valor_limpeza: t.valorLimpeza,
    taxa_pet: t.taxaPet,
    limpeza_unica: t.limpezaUnica,
    pessoas,
    total_mensal: tot.totalMensal,
    total_contrato: tot.totalContrato,
    mensagem,
  };
}

/**
 * Validade vencida → "Expirada". Roda na leitura (lista e detalhe) e na rotina diária de automações; filtra pelas
 * propostas de uma pessoa quando `userId` vem. Devolve quantas expiraram.
 */
export async function expirarVencidas(admin: SupabaseClient, userId?: string): Promise<number> {
  let q = admin
    .from("propostas")
    .update({ status: "expirada", atualizada_em: new Date().toISOString() })
    .in("status", STATUS_ABERTOS as string[])
    .lt("valida_ate", new Date().toISOString());
  if (userId) q = q.or(`owner_id.eq.${userId},tenant_id.eq.${userId}`);
  const { data, error } = await q.select("id");
  if (error) return 0;
  return (data ?? []).length;
}

export interface PropostaAcordada {
  id: string;
  numero: string;
  valorMensal: number;
  meses: number;
  dataEntrada: string;
  taxa: number | null;
}

/** Proposta ACEITA de uma candidatura (a mais recente): o fechamento e o contrato abrem com estes valores. */
export async function propostaAcordadaDoLead(admin: SupabaseClient, leadId: string): Promise<PropostaAcordada | null> {
  const { data: p } = await admin
    .from("propostas")
    .select("id, numero, versao_atual, taxa_congelada")
    .eq("lead_id", leadId)
    .in("status", ["aceita", "em_contrato", "contrato_assinado"])
    .order("aceita_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!p) return null;
  const { data: v } = await admin
    .from("proposta_versoes")
    .select("valor_mensal, meses, data_entrada")
    .eq("proposta_id", p.id)
    .eq("versao", p.versao_atual)
    .maybeSingle();
  if (!v) return null;
  return {
    id: p.id as string,
    numero: p.numero as string,
    valorMensal: Number(v.valor_mensal),
    meses: Number(v.meses),
    dataEntrada: String(v.data_entrada).slice(0, 10),
    taxa: p.taxa_congelada == null ? null : Number(p.taxa_congelada),
  };
}

/** Contrato registrado a partir da proposta → "Em contrato" (best-effort). */
export async function marcarPropostaEmContrato(admin: SupabaseClient, leadId: string): Promise<void> {
  await admin
    .from("propostas")
    .update({ status: "em_contrato", atualizada_em: new Date().toISOString() })
    .eq("lead_id", leadId)
    .eq("status", "aceita");
}
