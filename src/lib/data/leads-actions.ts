"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { COMISSAO_POR_PLANO, plano as planoPorId, type PlanoId } from "@/config/planos";
import { planoDoProprietario } from "@/lib/data/plano-efetivo";
import { situacaoCandidatura, type RotuloCandidatura } from "@/lib/candidaturas/status";
import { getPropertyForOwner } from "@/lib/data/properties";
import { formatDocNumber } from "@/lib/documents";
import type { Property } from "@/lib/types";
import { erroBancoPT } from "@/lib/erros-banco";
import { lerDocumento, temDocumento } from "@/lib/data/documento-servidor";
import { documentoCompleto, MSG_DOCUMENTO } from "@/lib/documento-pessoa";

interface ActionResult {
  ok: boolean;
  error?: string;
  demo?: boolean;
}

/**
 * ACEITE PERSISTIDO da candidatura (autoridade no SERVIDOR — nunca no cliente).
 *
 * - Só o DONO do lead decide (checado no servidor, além da RLS).
 * - Congela o plano e a comissão vigentes NA DATA DO ACEITE (regra
 *   anti-relâmpago: o fechamento herda este snapshot; downgrade não retroage).
 * - Revela ao proprietário nome completo + foto + verificação (a foto passa a
 *   ser assinada porque `relacaoAceitaEntreServidor` reconhece o lead aceito).
 *   NUNCA revela e-mail/telefone — a conversa segue só pela plataforma.
 * - Dispara o e-mail 'candidatura aceita' ao inquilino (best-effort).
 */
export async function aceitarCandidatura(leadId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para aceitar." };

  // Carrega o lead e confirma que o solicitante é o DONO (autoridade no servidor).
  const { data: lead, error: lErr } = await supabase
    .from("leads")
    .select("id, owner_id, tenant_id, status")
    .eq("id", leadId)
    .maybeSingle();
  if (lErr) return { ok: false, error: erroBancoPT(lErr) };
  if (!lead) return { ok: false, error: "Candidatura não encontrada." };
  if (lead.owner_id !== user.id) return { ok: false, error: "Sem permissão." };
  if (lead.status !== "new") return { ok: false, error: "Esta candidatura já foi decidida." };

  // A1: a decisão é gravada pelo SERVIDOR (0057 tirou o UPDATE do dono em
  // leads — dava para trocar o inquilino ou zerar a taxa congelada).
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Serviço indisponível." };
  // Cadastro confiável: o documento do dono vai no contrato — exigido ANTES do aceite.
  if (!(await temDocumento(admin, user.id))) return { ok: false, error: MSG_DOCUMENTO.aceitar };

  // Snapshot do plano do DONO agora → congela a comissão do contrato. O plano
  // só muda pelo servidor (0057: assinatura é só leitura para o dono).
  // Assinatura ATIVA; sem ela, Profissional se Fundador nos 12 meses grátis.
  const plano = await planoDoProprietario(admin, user.id);
  const comissao = COMISSAO_POR_PLANO[plano] ?? COMISSAO_POR_PLANO.free;

  const { error: uErr } = await admin
    .from("leads")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      decided_by: user.id,
      accepted_plan: plano,
      accepted_commission_rate: comissao,
    })
    .eq("id", leadId)
    .eq("owner_id", user.id)
    .eq("status", "new");
  if (uErr) return { ok: false, error: erroBancoPT(uErr) };

  // E-mail ao inquilino (só para notificação; contato do inquilino é lido via
  // service role, nunca devolvido ao cliente). Best-effort — nunca quebra.
  try {
    const admin = createAdminClient();
    if (admin) {
      const { data: t } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", lead.tenant_id)
        .maybeSingle();
      if (t?.email) {
        await notify({
          event: "candidatura_aceita",
          email: t.email,
          name: t.full_name ?? undefined,
          userId: lead.tenant_id,
          pushUrl: "/dashboard/candidaturas",
        });
      }
    }
  } catch {
    /* notificação nunca quebra o fluxo */
  }

  return { ok: true };
}

/**
 * RECUSA da candidatura — persiste no servidor com o motivo (visível só ao
 * dono). Push SILENCIOSO: sem e-mail ao inquilino. Na tela dele, o estado é
 * digno ("Não seguiu adiante"), nunca "recusada".
 */
export async function recusarCandidatura(leadId: string, motivo?: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para recusar." };

  const { data: lead, error: lErr } = await supabase
    .from("leads")
    .select("id, owner_id, status")
    .eq("id", leadId)
    .maybeSingle();
  if (lErr) return { ok: false, error: erroBancoPT(lErr) };
  if (!lead) return { ok: false, error: "Candidatura não encontrada." };
  if (lead.owner_id !== user.id) return { ok: false, error: "Sem permissão." };
  if (lead.status !== "new") return { ok: false, error: "Esta candidatura já foi decidida." };

  // A1: gravado pelo servidor (0057), depois da checagem de dono acima.
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Serviço indisponível." };
  const { error: uErr } = await admin
    .from("leads")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
      reject_reason: motivo?.trim()?.slice(0, 500) || null,
      decided_by: user.id,
    })
    .eq("id", leadId)
    .eq("owner_id", user.id)
    .eq("status", "new");
  if (uErr) return { ok: false, error: erroBancoPT(uErr) };

  return { ok: true };
}

export interface MinhaCandidatura {
  id: string;
  propertyTitle: string;
  situacao: RotuloCandidatura;
  createdAt: string | null;
}

/**
 * Candidaturas do INQUILINO logado — acompanhamento completo (todos os estados),
 * com o vocabulário digno da fonte única. Sem sessão/demo → lista vazia.
 */
export async function listMinhasCandidaturas(): Promise<MinhaCandidatura[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("leads")
    .select(
      `id, status, owner_id, property_id, created_at,
       property:properties!leads_property_id_fkey ( title )`,
    )
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  // "Em análise" = o dono já mandou mensagem ao inquilino nesse imóvel. Uma
  // consulta só: conjunto de (dono, imóvel) que já falaram com o inquilino.
  const { data: msgs } = await supabase
    .from("messages")
    .select("sender_id, property_id")
    .eq("receiver_id", user.id);
  const engajou = new Set((msgs ?? []).map((m) => `${m.sender_id}_${m.property_id}`));

  type Row = {
    id: string;
    status: string;
    owner_id: string;
    property_id: string;
    created_at: string | null;
    property: { title: string | null } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.id,
    propertyTitle: r.property?.title ?? "Imóvel",
    situacao: situacaoCandidatura(r.status, engajou.has(`${r.owner_id}_${r.property_id}`)),
    createdAt: r.created_at,
  }));
}

/** Número de contrato determinístico a partir do id da candidatura aceita. */
function numeroContrato(leadId: string, acceptedAt: string | null): string {
  const ano = Number((acceptedAt ?? "").slice(0, 4)) || 2026;
  let h = 0;
  for (const c of leadId) h = (h * 31 + c.charCodeAt(0)) % 10000;
  return formatDocNumber("contrato", ano, h || 1);
}

/**
 * Contexto do FECHAMENTO a partir de uma candidatura ACEITA real. Autoridade no
 * servidor: só o dono da candidatura, e SÓ com status 'accepted'. Herda imóvel,
 * partes e valores; a comissão é a CONGELADA no aceite (não o plano atual —
 * regra anti-relâmpago). Sem candidatura aceita → null (o fechamento não existe
 * sem ela; fim do imóvel-amostra fixo).
 */
export interface FechamentoContexto {
  leadId: string;
  property: Property;
  tenantName: string;
  planoId: string;
  planoNome: string;
  comissaoRate: number; // 0..1, congelada no aceite
  acceptedAt: string | null;
  contractNumber: string;
  /** Cadastro confiável: o que falta (CPF/CNPJ do dono ou do inquilino) para gerar o contrato. */
  documentoPendente?: { quem: "dono" | "inquilino"; mensagem: string } | null;
}

export async function getFechamentoContext(
  leadId?: string,
): Promise<FechamentoContexto | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // A candidatura aceita mais recente do dono (ou a apontada por leadId).
  let q = supabase
    .from("leads")
    .select("id, tenant_id, property_id, accepted_plan, accepted_commission_rate, accepted_at")
    .eq("owner_id", user.id)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false })
    .limit(1);
  if (leadId) q = q.eq("id", leadId);
  const { data: lead } = await q.maybeSingle();
  if (!lead) return null;

  // Imóvel (escopo do dono) — fonte real do card, valores e tipo.
  const property = await getPropertyForOwner(lead.property_id as string);
  if (!property) return null;

  // Nome do inquilino: revelado pós-aceite (nome completo). Lido via service
  // role (só exibição ao dono habilitado) — nunca contato.
  let tenantName = "Candidato(a)";
  let documentoPendente: FechamentoContexto["documentoPendente"] = null;
  try {
    const admin = createAdminClient();
    if (admin) {
      const [docDono, docInq] = await Promise.all([lerDocumento(admin, user.id), lerDocumento(admin, lead.tenant_id as string)]);
      if (!documentoCompleto(docDono)) documentoPendente = { quem: "dono", mensagem: MSG_DOCUMENTO.fecharDono };
      else if (!documentoCompleto(docInq)) documentoPendente = { quem: "inquilino", mensagem: MSG_DOCUMENTO.fecharInquilino };
      const { data: t } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", lead.tenant_id)
        .maybeSingle();
      if (t?.full_name && !String(t.full_name).includes("@")) tenantName = t.full_name;
    }
  } catch {
    /* mantém o neutro */
  }

  const planoId = ((lead.accepted_plan as string) ?? "free") as PlanoId;
  // Comissão CONGELADA no aceite; retrocompatível se o snapshot faltar.
  const comissaoRate =
    typeof lead.accepted_commission_rate === "number"
      ? lead.accepted_commission_rate
      : COMISSAO_POR_PLANO[planoId] ?? COMISSAO_POR_PLANO.free;

  return {
    leadId: lead.id as string,
    property,
    tenantName,
    planoId,
    planoNome: planoPorId(planoId)?.nome ?? "Gratuito",
    comissaoRate,
    acceptedAt: (lead.accepted_at as string) ?? null,
    contractNumber: numeroContrato(lead.id as string, (lead.accepted_at as string) ?? null),
    documentoPendente,
  };
}
