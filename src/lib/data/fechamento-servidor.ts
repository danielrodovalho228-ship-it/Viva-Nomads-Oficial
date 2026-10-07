import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { taxaDoContrato } from "@/config/planos";
import { cpfValido, documentoParaContrato, MSG_DOCUMENTO } from "@/lib/documento-pessoa";
import { lerDocumento } from "@/lib/data/documento-servidor";

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
  if (typeof leadId !== "string" || !UUID_RE.test(leadId)) return { status: 400, error: "Candidatura inválida." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { status: 503, error: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 401, error: "Não autenticado." };

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
  const aluguel = Number(imovel.monthly_price);
  if (!Number.isFinite(aluguel) || aluguel <= 0) return { status: 400, error: "Imóvel sem valor de aluguel." };

  // Taxa congelada no aceite; NULL cai para a do plano no aceite (nunca 0).
  const comissaoRate = taxaDoContrato(lead.accepted_commission_rate, lead.accepted_plan);
  // Cadastro confiável: contrato e cobrança só com o documento das DUAS partes.
  const docDono = documentoParaContrato(docDonoPerfil);
  if (!docDono) return { status: 409, error: MSG_DOCUMENTO.fecharDono };
  if (!cpfValido(docInquilino?.cpf)) return { status: 409, error: MSG_DOCUMENTO.fecharInquilino };

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

/**
 * Reserva o direito de criar a cobrança/contrato desta candidatura (uma vez).
 * true = pode criar; false = já existe (idempotente).
 */
export async function reservarFechamento(leadId: string, tipo: "comissao" | "contrato"): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;
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
