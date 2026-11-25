import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { taxaDoContrato } from "@/config/planos";
import { DIAS_POR_MES } from "@/lib/contrato-blocos";
import { documentoParaContrato } from "@/lib/documento-pessoa";
import { motivoBloqueioContrato } from "@/lib/contrato-trava";
import { lerDocumento } from "@/lib/data/documento-servidor";
import { docsInquilinoCompletos } from "@/lib/data/documentos-inquilino-servidor";
import { PROPOSTA_FORA_DO_FECHAMENTO, preAceiteExpiradoDoLead, propostaDoFechamentoDoLead } from "@/lib/data/propostas-servidor";
import { MSG_PRE_ACEITE_EXPIRADO } from "@/lib/data/pre-aceite-fechamento";
import { MSG_VALORES_SEM_CONFERIR, taxaDoLeadDoDono } from "@/lib/data/taxa-dono-servidor";
import { RESERVA_EXPIRA_MS, type ReservaLida } from "@/lib/fechamento-contrato";
import { filtroDaChave } from "@/lib/contrato-da-proposta";

/**
 * A5: os dados de uma cobrança/contrato de fechamento vêm SÓ do banco, a partir
 * de uma candidatura ACEITA do usuário logado (dono). Nada de valor, taxa,
 * carteira, nome ou e-mail vindos do navegador.
 */
export interface DadosFechamento {
  leadId: string;
  /** E1141: a proposta (a estadia) que o fecho pediu com `p` e o servidor validou; null = a regra de sempre. */
  propostaPedida: string | null;
  propertyId: string;
  tituloImovel: string;
  aluguelMensal: number;
  comissaoRate: number;
  ownerId: string;
  ownerNome: string;
  /** Pagador da comissão: o PROPRIETÁRIO. */
  ownerEmail: string | null;
  ownerCpfCnpj: string | null;
  tenantId: string;
  tenantNome: string;
  tenantEmail: string | null;
}

export type FalhaFechamento = { status: number; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** E1141: o `p` pedido não é uma proposta acordada desta candidatura. */
export const MSG_FECHO_NAO_ENCONTRADO = "Não encontramos esse fechamento.";

export async function carregarFechamento(leadId: unknown, propostaId?: unknown): Promise<DadosFechamento | FalhaFechamento> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { status: 503, error: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 401, error: "Não autenticado." };
  // Sessão ANTES de validar o corpo: visitante sem login recebe 401, nunca 400 (t49).
  if (typeof leadId !== "string" || !UUID_RE.test(leadId)) return { status: 400, error: "Candidatura inválida." };
  // E1141: a estadia pedida (opcional). Sem ela, a regra de sempre; com ela, só um id de proposta.
  if (propostaId != null && (typeof propostaId !== "string" || !UUID_RE.test(propostaId))) return { status: 400, error: "Proposta inválida." };
  const propostaPedida = propostaId == null ? null : (propostaId as string);

  // Candidatura ACEITA em que o usuário logado é o DONO (sessão + RLS "leads das partes").
  const { data: lead } = await supabase
    .from("leads")
    .select("id, owner_id, tenant_id, property_id")
    .eq("id", leadId)
    .eq("owner_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();
  if (!lead) return { status: 404, error: "Candidatura aceita não encontrada." };

  const [{ data: imovel }, { data: dono, error: erroDono }, { data: inquilino, error: erroInquilino }, docDonoPerfil, docInquilino] = await Promise.all([
    admin.from("properties").select("title, monthly_price, owner_id").eq("id", lead.property_id).maybeSingle(),
    admin.from("profiles").select("full_name, email").eq("id", lead.owner_id).maybeSingle(),
    admin.from("profiles").select("full_name, email").eq("id", lead.tenant_id).maybeSingle(),
    lerDocumento(admin, lead.owner_id as string),
    lerDocumento(admin, lead.tenant_id as string),
  ]);
  // Estados vazios: sem o perfil das partes, o contrato e a cobrança sairiam com "Proprietário"/"Inquilino" e sem e-mail.
  if (erroDono || erroInquilino) return { status: 503, error: "Não foi possível ler os dados das partes agora. Tente de novo em instantes." };
  if (!imovel || imovel.owner_id !== lead.owner_id) return { status: 404, error: "Imóvel não encontrado." };
  // E968: pré-aceitação expirada = a candidatura voltou ao dono; nada de preço do anúncio no lugar do congelado.
  const preAceiteExpirado = await preAceiteExpiradoDoLead(admin, lead.id as string).catch(() => "falhou" as const);
  if (preAceiteExpirado === "falhou") return { status: 503, error: MSG_VALORES_SEM_CONFERIR };
  if (preAceiteExpirado) return { status: 409, error: MSG_PRE_ACEITE_EXPIRADO };
  // Prompt 17: com proposta aceita, vale o valor mensal ACORDADO (não o do anúncio).
  // E1141: a proposta DESTE fecho — a pedida com `p` (validada: desta candidatura e acordada) ou a de sempre.
  const acordada = await propostaDoFechamentoDoLead(admin, lead.id as string, propostaPedida).catch(() => "falhou" as const);
  if (acordada === "falhou") return { status: 503, error: MSG_VALORES_SEM_CONFERIR };
  if (acordada === PROPOSTA_FORA_DO_FECHAMENTO) return { status: 404, error: MSG_FECHO_NAO_ENCONTRADO };
  const aluguel = acordada ? acordada.valorMensal : Number(imovel.monthly_price);
  if (!Number.isFinite(aluguel) || aluguel <= 0) return { status: 400, error: "Imóvel sem valor de aluguel." };

  // Taxa congelada no aceite; NULL cai para a do plano no aceite (nunca 0).
  // Plano e taxa do aceite pelo servidor (a sessão não lê mais essas colunas — 0177); o dono já foi conferido acima.
  const taxaLead = await taxaDoLeadDoDono(admin, user.id, lead.id as string).catch(() => "falhou" as const);
  if (taxaLead === "falhou") return { status: 503, error: MSG_VALORES_SEM_CONFERIR };
  const comissaoRate = taxaDoContrato(taxaLead?.acceptedCommissionRate ?? null, taxaLead?.acceptedPlan ?? null);
  // Cadastro confiável + F32: documento das DUAS partes e documentos do inquilino
  // (B2; null = sem a 0093 → não trava). A MESMA trava vale em registrarContrato.
  const bloqueio = motivoBloqueioContrato({
    dono: docDonoPerfil,
    inquilino: docInquilino,
    docsInquilinoCompletos: await docsInquilinoCompletos(admin, lead.id as string),
  });
  if (bloqueio) return { status: bloqueio.status, error: bloqueio.erro };
  const docDono = documentoParaContrato(docDonoPerfil);

  return {
    leadId: lead.id as string,
    propostaPedida,
    propertyId: lead.property_id as string,
    tituloImovel: imovel.title as string,
    aluguelMensal: aluguel,
    comissaoRate,
    ownerId: lead.owner_id as string,
    ownerNome: (dono?.full_name as string) || "Proprietário",
    ownerEmail: (dono?.email as string) ?? null,
    ownerCpfCnpj: docDono,
    tenantId: lead.tenant_id as string,
    tenantNome: (inquilino?.full_name as string) || "Inquilino",
    tenantEmail: (inquilino?.email as string) ?? null,
  };
}

/** Achados 81/82: leitura do fechamento que falha — a rota responde 503, nunca uma resposta enganosa. */
export const MSG_FECHAMENTO_SEM_LEITURA = "Não foi possível conferir o fechamento agora. Tente de novo em instantes.";

/** E1086: a chave do fechamento leva a proposta acordada (null = fechamento sem proposta). */
function daChave<Q>(consulta: Q, propostaId: string | null): Q {
  const f = filtroDaChave(propostaId);
  // O tipo do construtor de consultas é fundo demais para um genérico; o filtro é só "coluna = valor" ou "coluna é nula".
  const q = consulta as unknown as { eq(c: string, v: string): unknown; is(c: string, v: null): unknown };
  return (f.valor === null ? q.is(f.coluna, null) : q.eq(f.coluna, f.valor)) as Q;
}

/** Reserva atual da cobrança/contrato DESTA proposta da candidatura (null = nenhuma). */
export async function lerReservaFechamento(leadId: string, tipo: "comissao" | "contrato", propostaId: string | null): Promise<ReservaLida | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await daChave(
    admin
      .from("cobrancas_fechamento")
      .select("externo_id, criado_em")
      .eq("lead_id", leadId)
      .eq("tipo", tipo),
    propostaId
  ).maybeSingle();
  // Achado 82: falha de leitura não vira "nenhuma reserva" (a tela dizia "em andamento" ou tentava reservar de novo).
  if (error) throw new Error(MSG_FECHAMENTO_SEM_LEITURA);
  return data ? { externoId: (data.externo_id as string | null) ?? null, criadoEm: String(data.criado_em) } : null;
}

/**
 * Reserva o direito de criar a cobrança/contrato desta candidatura (uma vez).
 * true = pode criar; false = já existe (idempotente). Prompt 24: reserva SEM conclusão (a resposta nunca chegou)
 * vence em RESERVA_EXPIRA_MS e é liberada aqui — nenhum caminho deixa a candidatura presa.
 */
export async function reservarFechamento(leadId: string, tipo: "comissao" | "contrato", propostaId: string | null): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  await daChave(
    admin
      .from("cobrancas_fechamento")
      .delete()
      .eq("lead_id", leadId)
      .eq("tipo", tipo),
    propostaId
  )
    .is("externo_id", null)
    .lt("criado_em", new Date(Date.now() - RESERVA_EXPIRA_MS).toISOString());
  const { error } = await admin.from("cobrancas_fechamento").insert({ lead_id: leadId, tipo, proposta_id: propostaId });
  return !error;
}

export async function concluirFechamento(leadId: string, tipo: "comissao" | "contrato", propostaId: string | null, externoId: string | null) {
  const admin = createAdminClient();
  if (!admin) return;
  if (externoId === null) {
    // Falhou: libera para nova tentativa (só a reserva desta proposta; a de outra estadia fica).
    await daChave(admin.from("cobrancas_fechamento").delete().eq("lead_id", leadId).eq("tipo", tipo), propostaId);
    return;
  }
  await daChave(admin.from("cobrancas_fechamento").update({ externo_id: externoId }).eq("lead_id", leadId).eq("tipo", tipo), propostaId);
}

/**
 * E1086: o contrato do fechamento em curso — o da proposta acordada (ou, sem proposta, o da candidatura sem proposta).
 * O contrato de outra proposta da mesma candidatura é de OUTRA estadia e nunca volta daqui. Falha de leitura LANÇA.
 */
export async function contratoDoFechamentoDoLead(admin: SupabaseClient, leadId: string, propostaId: string | null) {
  const { data, error } = await daChave(
    admin.from("contratos").select("id, proposta_id, created_at, garantia, aluguel_mensal, prazo_total_dias, comissao_percent").eq("lead_id", leadId),
    propostaId
  )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(MSG_FECHAMENTO_SEM_LEITURA);
  return (data as { id: string; proposta_id: string | null; created_at: string; garantia: string | null; aluguel_mensal: number; prazo_total_dias: number; comissao_percent: number } | null) ?? null;
}

/** Dados da comissão tirados do CONTRATO registrado (snapshot congelado no fechamento). */
export interface ComissaoDoContrato {
  aluguelMensal: number;
  meses: number;
  /** E562: a estadia em dias exatos (o registro do contrato e a taxa são em dias). */
  dias: number;
  taxa: number;
  /** E1086: a proposta a que o contrato (e a cobrança da taxa) pertence; null = fechamento sem proposta. */
  propostaId: string | null;
}

/**
 * A comissão incide sobre o VALOR TOTAL do contrato (ordens b3c9d76e e c54366b0). Por isso aluguel, meses
 * e taxa vêm do contrato JÁ REGISTRADO desta candidatura — o mesmo dado de contratos.comissao_valor —,
 * nunca de um prazo enviado pelo navegador (que poderia mandar 1 mês e pagar menos). Sem contrato = null.
 */
export async function comissaoDoContrato(leadId: string, propostaPedida: string | null = null): Promise<ComissaoDoContrato | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  // Achado 81: falha de leitura não vira "registre o contrato antes" (409) — lança; a rota responde 503.
  // E1086: o contrato é o DA PROPOSTA acordada (a taxa de uma estadia nunca se calcula pelo contrato de outra).
  // E1141: a proposta pedida pelo fecho (já validada em `carregarFechamento`) ou, sem ela, a de sempre.
  const acordada = await propostaDoFechamentoDoLead(admin, leadId, propostaPedida);
  if (acordada === PROPOSTA_FORA_DO_FECHAMENTO) return null;
  const propostaId = acordada ? acordada.id : null;
  const data = await contratoDoFechamentoDoLead(admin, leadId, propostaId);
  if (!data) return null;
  return {
    aluguelMensal: Number(data.aluguel_mensal),
    meses: Math.round(Number(data.prazo_total_dias) / DIAS_POR_MES),
    dias: Number(data.prazo_total_dias),
    taxa: Number(data.comissao_percent),
    propostaId,
  };
}
