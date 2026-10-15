"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/notifications/email";
import {
  assuntoAvisoOutraParte,
  avisoAssinatura,
  hashResumo,
  petsRegrasDoResumo,
  motivoNaoPodeAssinar,
  papelNoContrato,
  resumoContrato,
  type PapelContrato,
} from "@/lib/contrato-assinar";
import { motivoFaltamInstrucoes } from "@/lib/checkin";
import { instrucoesPreenchidas } from "@/lib/checkin-servidor";
import { montarLinhaDoTempo, type EtapaEstadia } from "@/lib/estadia-linha-tempo";
import {
  MSG_CODIGO_BLOQUEADO,
  VALIDADE_CODIGO_ASSINATURA_MS,
  conferirCodigo,
  gerarCodigoAssinatura,
  hashCodigoAssinatura,
  podeReenviar,
  type LinhaCodigo,
} from "@/lib/contrato-codigo";

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
  /** Entrada, conferência e saída com dia e horário (vazio se o contrato ainda não tem blocos). */
  linhaDoTempo: EtapaEstadia[];
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
  properties: { title?: string; owner_id?: string; checkin_after?: string | null; checkout_before?: string | null; pets_regras?: unknown } | null;
  pets_regras_congeladas?: unknown;
  contrato_blocos?: { inicio: string; fim: string }[] | null;
}

const COLUNAS =
  "id, tenant_id, status, aluguel_mensal, prazo_total_dias, qtd_ocupantes, created_at, assinado_proprietario_em, assinado_inquilino_em, pets_regras_congeladas, properties(title, owner_id, checkin_after, checkout_before, pets_regras), contrato_blocos(inicio, fim)";

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
    petsRegras: petsRegrasDoResumo({
      algumaAssinatura: !!(c.assinado_proprietario_em || c.assinado_inquilino_em),
      vivas: c.properties?.pets_regras,
      congeladas: c.pets_regras_congeladas,
    }),
  });
  const datas = (c.contrato_blocos ?? []).filter((b) => b?.inicio && b?.fim);
  const inicio = datas.map((b) => b.inicio).sort()[0] ?? null;
  const fim = datas.map((b) => b.fim).sort().at(-1) ?? null;
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
    linhaDoTempo: montarLinhaDoTempo({
      inicio,
      fim,
      checkinAfter: c.properties?.checkin_after ?? null,
      checkoutBefore: c.properties?.checkout_before ?? null,
    }),
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

/** Envia ao e-mail da conta um código de 6 dígitos, de uso único, que vale 15 minutos (conferido no servidor). */
export async function pedirCodigoAssinatura(contratoId: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(String(contratoId))) return { ok: false, error: "Contrato inválido." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Entre para assinar." };
  const { data } = await admin.from("contratos").select(COLUNAS).eq("id", contratoId).maybeSingle();
  const c = data as unknown as LinhaContrato | null;
  const visao = c ? montar(c, user.id) : null;
  if (!c || !visao) return { ok: false, error: "Contrato não encontrado." };
  if (c.status !== "ativo") return { ok: false, error: "Este contrato não está mais aguardando assinatura." };
  if (visao.euAssinei) return { ok: false, error: "Você já assinou este contrato." };
  const faltam = motivoFaltamInstrucoes({ papel: visao.papel, preenchidas: await instrucoesPreenchidas(admin, c.id) });
  if (faltam) return { ok: false, error: faltam };

  const agora = Date.now();
  const { data: atual } = await admin
    .from("contrato_assinatura_codigos")
    .select("enviado_em")
    .eq("contrato_id", c.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!podeReenviar(atual as { enviado_em: string } | null, agora)) {
    return { ok: false, error: "Espere 1 minuto para pedir outro código." };
  }
  const codigo = gerarCodigoAssinatura();
  const { error: errGrava } = await admin.from("contrato_assinatura_codigos").upsert(
    {
      contrato_id: c.id,
      user_id: user.id,
      codigo_hash: hashCodigoAssinatura(user.id, c.id, codigo),
      expira_em: new Date(agora + VALIDADE_CODIGO_ASSINATURA_MS).toISOString(),
      falhas: 0,
      usado_em: null,
      enviado_em: new Date(agora).toISOString(),
    },
    { onConflict: "contrato_id,user_id" },
  );
  if (errGrava) return { ok: false, error: "Não foi possível gerar o código. Tente de novo." };
  const r = await sendEmail({
    to: user.email,
    subject: "Seu código para assinar o contrato",
    text: `Seu código para assinar o contrato de "${visao.imovel}": ${codigo}\nVale por 15 minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail e troque a senha.`,
    html: `<p>Seu código para assinar o contrato de <strong>${visao.imovel.replace(/[<>&]/g, "")}</strong>: <strong style="font-size:20px;letter-spacing:4px">${codigo}</strong></p><p>Vale por 15 minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail e troque a senha.</p>`,
  });
  if (r.error) return { ok: false, error: "Não foi possível enviar o e-mail agora. Tente de novo." };
  return { ok: true };
}

export async function assinarContrato(input: {
  contratoId: string;
  aceite: boolean;
  /** 6 dígitos recebidos por e-mail (pedirCodigoAssinatura). */
  codigo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(String(input.contratoId))) return { ok: false, error: "Contrato inválido." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: "Serviço indisponível." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para assinar." };

  let { data } = await admin.from("contratos").select(COLUNAS).eq("id", input.contratoId).maybeSingle();
  let c = data as unknown as LinhaContrato | null;
  // Primeira assinatura: congela as regras de pets do anúncio no contrato (uma vez só), para a outra parte
  // assinar o mesmo resumo/hash mesmo que o dono mude o anúncio depois.
  if (c && !c.assinado_proprietario_em && !c.assinado_inquilino_em && c.pets_regras_congeladas == null) {
    await admin
      .from("contratos")
      .update({ pets_regras_congeladas: c.properties?.pets_regras ?? {} })
      .eq("id", c.id)
      .is("pets_regras_congeladas", null);
    ({ data } = await admin.from("contratos").select(COLUNAS).eq("id", input.contratoId).maybeSingle());
    c = data as unknown as LinhaContrato | null;
  }
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
  // Check-in garantido: o proprietário só assina com as instruções de entrada preenchidas (conferido aqui, no servidor).
  const faltam = motivoFaltamInstrucoes({ papel: visao.papel, preenchidas: await instrucoesPreenchidas(admin, c.id) });
  if (faltam) return { ok: false, error: faltam };

  // Confirmação de identidade NO SERVIDOR: código de e-mail de uso único, com validade e limite de falhas.
  const { data: linhaCodigo } = await admin
    .from("contrato_assinatura_codigos")
    .select("codigo_hash, expira_em, falhas, usado_em, enviado_em")
    .eq("contrato_id", c.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const lc = (linhaCodigo as LinhaCodigo | null) ?? null;
  const conf = conferirCodigo(lc, input.codigo, user.id, c.id, Date.now());
  if (!conf.ok) {
    if (conf.contarFalha && lc) {
      await admin
        .from("contrato_assinatura_codigos")
        .update({ falhas: lc.falhas + 1 })
        .eq("contrato_id", c.id)
        .eq("user_id", user.id)
        .is("usado_em", null);
    }
    return { ok: false, error: conf.erro };
  }
  // Consome o código antes de gravar: só uma assinatura por código, mesmo com dois cliques ao mesmo tempo.
  const { data: consumido } = await admin
    .from("contrato_assinatura_codigos")
    .update({ usado_em: new Date().toISOString() })
    .eq("contrato_id", c.id)
    .eq("user_id", user.id)
    .eq("codigo_hash", lc!.codigo_hash)
    .is("usado_em", null)
    .select("contrato_id");
  if (!consumido?.length) return { ok: false, error: MSG_CODIGO_BLOQUEADO };

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
  const outraJaAssinou = !!(visao.papel === "inquilino" ? c.assinado_proprietario_em : c.assinado_inquilino_em);
  const outroId = visao.papel === "inquilino" ? String(c.properties?.owner_id ?? "") : c.tenant_id;
  after(async () => {
    try {
      const { data: pessoa } = await admin.auth.admin.getUserById(outroId);
      await notify({
        event: "contract_status",
        email: pessoa?.user?.email ?? undefined,
        userId: outroId,
        // Quem recebe é a outra parte: o dono abre em Contratos, o inquilino em Minhas locações.
        pushUrl: visao.papel === "inquilino" ? `/dashboard/contratos/${c.id}` : `/dashboard/locacoes/${c.id}`,
        subject: assuntoAvisoOutraParte(outraJaAssinou),
      });
    } catch {
      /* aviso é best-effort: a assinatura já está gravada */
    }
  });
  return { ok: true };
}
