import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { taxaDoContrato } from "@/config/planos";
import { DIAS_POR_MES } from "@/lib/contrato-blocos";
import { documentoParaContrato } from "@/lib/documento-pessoa";
import { motivoBloqueioContrato } from "@/lib/contrato-trava";
import { lerDocumento } from "@/lib/data/documento-servidor";
import { docsInquilinoCompletos } from "@/lib/data/documentos-inquilino-servidor";
import { propostaAcordadaDoLead } from "@/lib/data/propostas-servidor";
import { RESERVA_EXPIRA_MS, type ReservaLida } from "@/lib/fechamento-contrato";

/**
 * A5: os dados de uma cobrança/contrato de fechamento vêm SÓ do banco, a partir
 * de uma candidatura ACEITA do usuário logado (dono). Nada de valor, taxa,
 * carteira, nome ou e-mail vindos do navegador.
 */
export interface DadosFechamento {
  leadId: string;
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

export async function carregarFechamento(leadId: unknown): Promise<DadosFechamento | FalhaFechamento> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { status: 503, error: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 401, error: "Não autenticado." };
  // Sessão ANTES de validar o corpo: visitante sem login recebe 401, nunca 400 (t49).
  if (typeof leadId !== "string" || !UUID_RE.test(leadId)) return { status: 400, error: "Candidatura inválida." };

  // Candidatura ACEITA em que o usuário logado é o DONO (sessão + RLS "leads das partes").
  const { data: lead } = await supabase
    .from("leads")
    .select("id, owner_id, tenant_id, property_id, accepted_commission_rate, accepted_plan")
    .eq("id", leadId)
    .eq("owner_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();
  if (!lead) return { status: 404, error: "Candidatura aceita não encontrada." };

  const [{ data: imovel }, { data: dono }, { data: inquilino }, docDonoPerfil, docInquilino] = await Promise.all([
    admin.from("properties").select("title, monthly_price, owner_id").eq("id", lead.property_id).maybeSingle(),
    admin.from("profiles").select("full_name, email").eq("id", lead.owner_id).maybeSingle(),
    admin.from("profiles").select("full_name, email").eq("id", lead.tenant_id).maybeSingle(),
    lerDocumento(admin, lead.owner_id as string),
    lerDocumento(admin, lead.tenant_id as string),
  ]);
  if (!imovel || imovel.owner_id !== lead.owner_id) return { status: 404, error: "Imóvel não encontrado." };
  // Prompt 17: com proposta aceita, vale o valor mensal ACORDADO (não o do anúncio).
  const acordada = await propostaAcordadaDoLead(admin, lead.id as string);
  const aluguel = acordada ? acordada.valorMensal : Number(imovel.monthly_price);
  if (!Number.isFinite(aluguel) || aluguel <= 0) return { status: 400, error: "Imóvel sem valor de aluguel." };

  // Taxa congelada no aceite; NULL cai para a do plano no aceite (nunca 0).
  const comissaoRate = taxaDoContrato(lead.accepted_commission_rate, lead.accepted_plan);
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

/** Reserva atual da cobrança/contrato desta candidatura (null = nenhuma). */
export async function lerReservaFechamento(leadId: string, tipo: "comissao" | "contrato"): Promise<ReservaLida | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("cobrancas_fechamento")
    .select("externo_id, criado_em")
    .eq("lead_id", leadId)
    .eq("tipo", tipo)
    .maybeSingle();
  return data ? { externoId: (data.externo_id as string | null) ?? null, criadoEm: String(data.criado_em) } : null;
}

/**
 * Reserva o direito de criar a cobrança/contrato desta candidatura (uma vez).
 * true = pode criar; false = já existe (idempotente). Prompt 24: reserva SEM conclusão (a resposta nunca chegou)
 * vence em RESERVA_EXPIRA_MS e é liberada aqui — nenhum caminho deixa a candidatura presa.
 */
export async function reservarFechamento(leadId: string, tipo: "comissao" | "contrato"): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
  await admin
    .from("cobrancas_fechamento")
    .delete()
    .eq("lead_id", leadId)
    .eq("tipo", tipo)
    .is("externo_id", null)
    .lt("criado_em", new Date(Date.now() - RESERVA_EXPIRA_MS).toISOString());
  const { error } = await admin.from("cobrancas_fechamento").insert({ lead_id: leadId, tipo });
  return !error;
}

export async function concluirFechamento(leadId: string, tipo: "comissao" | "contrato", externoId: string | null) {
  const admin = createAdminClient();
  if (!admin) return;
  if (externoId === null) {
    // Falhou: libera para nova tentativa.
    await admin.from("cobrancas_fechamento").delete().eq("lead_id", leadId).eq("tipo", tipo);
    return;
  }
  await admin.from("cobrancas_fechamento").update({ externo_id: externoId }).eq("lead_id", leadId).eq("tipo", tipo);
}

/** Dados da comissão tirados do CONTRATO registrado (snapshot congelado no fechamento). */
export interface ComissaoDoContrato {
  aluguelMensal: number;
  meses: number;
  taxa: number;
}

/**
 * A comissão incide sobre o VALOR TOTAL do contrato (ordens b3c9d76e e c54366b0). Por isso aluguel, meses
 * e taxa vêm do contrato JÁ REGISTRADO desta candidatura — o mesmo dado de contratos.comissao_valor —,
 * nunca de um prazo enviado pelo navegador (que poderia mandar 1 mês e pagar menos). Sem contrato = null.
 */
export async function comissaoDoContrato(leadId: string): Promise<ComissaoDoContrato | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("contratos")
    .select("aluguel_mensal, prazo_total_dias, comissao_percent")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (!data) return null;
  return {
    aluguelMensal: Number(data.aluguel_mensal),
    meses: Math.round(Number(data.prazo_total_dias) / DIAS_POR_MES),
    taxa: Number(data.comissao_percent),
  };
}
