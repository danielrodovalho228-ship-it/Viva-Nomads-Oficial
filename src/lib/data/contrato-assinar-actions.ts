"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import {
  avisoAssinatura,
  hashResumo,
  motivoNaoPodeAssinar,
  papelNoContrato,
  resumoContrato,
  type PapelContrato,
} from "@/lib/contrato-assinar";

/*
  Assinatura eletrônica na plataforma (ordem 0fd301f0, F40). A leitura passa pelo RLS (as duas partes);
  a gravação é SÓ do servidor: valida a sessão, o papel, o status e o aceite, e registra
  quem/quando/IP/hash do resumo que a pessoa viu em contrato_assinaturas.
*/

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ContratoParaAssinar {
  id: string;
  imovel: string;
  status: string;
  papel: PapelContrato;
  resumo: string[];
  assinadoProprietarioEm: string | null;
  assinadoInquilinoEm: string | null;
  aviso: string;
  euAssinei: boolean;
}

interface LinhaContrato {
  id: string;
  tenant_id: string;
  status: string;
  aluguel_mensal: number | string;
  prazo_total_dias: number | string;
  qtd_ocupantes: number | string;
  created_at: string;
  assinado_proprietario_em: string | null;
  assinado_inquilino_em: string | null;
  properties: { title?: string; owner_id?: string } | null;
}

const COLUNAS =
  "id, tenant_id, status, aluguel_mensal, prazo_total_dias, qtd_ocupantes, created_at, assinado_proprietario_em, assinado_inquilino_em, properties(title, owner_id)";

function montar(c: LinhaContrato, userId: string): ContratoParaAssinar | null {
  const ownerId = String(c.properties?.owner_id ?? "");
  const papel = papelNoContrato(userId, c.tenant_id, ownerId);
  if (!papel) return null;
  const imovel = c.properties?.title ?? "Imóvel";
  const resumo = resumoContrato({
    contratoId: c.id,
    imovel,
    aluguelMensal: Number(c.aluguel_mensal),
    prazoDias: Number(c.prazo_total_dias),
    ocupantes: Number(c.qtd_ocupantes),
    criadoEm: c.created_at.slice(0, 10),
  });
  const a = { proprietario: c.assinado_proprietario_em, inquilino: c.assinado_inquilino_em };
  return {
    id: c.id,
    imovel,
    status: c.status,
    papel,
    resumo,
    assinadoProprietarioEm: a.proprietario,
    assinadoInquilinoEm: a.inquilino,
    aviso: avisoAssinatura(papel, a),
    euAssinei: !!(papel === "inquilino" ? a.inquilino : a.proprietario),
  };
}

/** Detalhe do contrato para as duas partes. null = não existe ou a pessoa não é parte (o RLS esconde). */
export async function getContratoParaAssinar(contratoId: string): Promise<ContratoParaAssinar | null> {
  if (!UUID_RE.test(contratoId)) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("contratos").select(COLUNAS).eq("id", contratoId).maybeSingle();
  return data ? montar(data as unknown as LinhaContrato, user.id) : null;
}

export async function assinarContrato(input: {
  contratoId: string;
  aceite: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(String(input.contratoId))) return { ok: false, error: "Contrato inválido." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para assinar." };

  const { data } = await admin.from("contratos").select(COLUNAS).eq("id", input.contratoId).maybeSingle();
  const c = data as unknown as LinhaContrato | null;
  const visao = c ? montar(c, user.id) : null;
  if (!c || !visao) return { ok: false, error: "Contrato não encontrado." };

  const jaAssinou = visao.papel === "inquilino" ? c.assinado_inquilino_em : c.assinado_proprietario_em;
  const motivo = motivoNaoPodeAssinar({
    status: c.status,
    papel: visao.papel,
    assinadoEm: jaAssinou,
    aceite: input.aceite === true,
  });
  if (motivo) return { ok: false, error: motivo };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim().slice(0, 64) || null;
  const agora = new Date().toISOString();

  const { error: errReg } = await admin.from("contrato_assinaturas").insert({
    contrato_id: c.id,
    user_id: user.id,
    papel: visao.papel,
    assinado_em: agora,
    ip,
    hash_documento: hashResumo(visao.resumo),
  });
  if (errReg) return { ok: false, error: "Não foi possível registrar a assinatura. Tente de novo." };

  const coluna = visao.papel === "inquilino" ? "assinado_inquilino_em" : "assinado_proprietario_em";
  const { error: errCol } = await admin.from("contratos").update({ [coluna]: agora }).eq("id", c.id).is(coluna, null);
  if (errCol) return { ok: false, error: "Não foi possível registrar a assinatura. Tente de novo." };

  // Avisa a outra parte (notificação + e-mail), depois da resposta.
  const outroId = visao.papel === "inquilino" ? String(c.properties?.owner_id ?? "") : c.tenant_id;
  after(async () => {
    try {
      const { data: pessoa } = await admin.auth.admin.getUserById(outroId);
      await notify({
        event: "contract_status",
        email: pessoa?.user?.email ?? undefined,
        userId: outroId,
        pushUrl: `/dashboard/locacoes/${c.id}`,
        subject: "O outro lado assinou o contrato — falta a sua assinatura",
      });
    } catch {
      /* aviso é best-effort: a assinatura já está gravada */
    }
  });
  return { ok: true };
}
