"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { brandedNotification, notificationText } from "@/lib/notifications/templates";
import { SITE_URL } from "@/lib/site";
import { isValidEmail } from "@/lib/auth-errors";
import { headers } from "next/headers";
import {
  EXCLUSAO_TTL_S,
  criarTokenExclusao,
  hashSeguro,
  lerTokenExclusao,
  normalizarEmail,
} from "@/lib/conta/exclusao-token";

/**
 * Exclusão de conta pela PÁGINA PÚBLICA (/excluir-conta), exigida pela Play Store:
 * funciona SEM login. O usuário informa o e-mail → mandamos um link de confirmação
 * ao DONO do e-mail → ao confirmar (clique explícito, nunca no load), a conta é
 * apagada. A exclusão remove `auth.users` (mesmo efeito de `delete_user_account()`,
 * que o próprio usuário usa dentro do app) e cascateia perfil, imóveis, leads,
 * mensagens, contratos, favoritos, tokens de push, etc.
 *
 * M1 (migração 0055):
 *  - a conta é achada por e-mail EXATO em auth.users (RPC uid_por_email_exato) —
 *    antes era `ilike`, e "_"/"%" no e-mail digitado viravam coringa (dava para
 *    mandar o link para a SUA caixa e apagar a conta de outra pessoa);
 *  - o token leva o id do PEDIDO e o uid; vale 30 min e é de USO ÚNICO
 *    (exclusao_conta_pedidos.usado_em);
 *  - limite de pedidos por e-mail e por IP (só hashes são guardados).
 */

const LIMITE_POR_EMAIL_HORA = 3;
const LIMITE_POR_IP_HORA = 10;

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Verifica se o usuário é parte de contratos/locações (como inquilino OU dono).
 * Em caso de erro de leitura, assume o pior (há histórico ativo) — nunca deixa
 * cair no apagar em cascata, que destruiria registros de retenção legal.
 */
async function situacaoContratos(
  admin: AdminClient,
  uid: string
): Promise<{ temHistorico: boolean; temAtivo: boolean }> {
  try {
    const [tC, oC, tL, oL] = await Promise.all([
      admin.from("contratos").select("status").eq("tenant_id", uid),
      admin.from("contratos").select("status, properties!inner(owner_id)").eq("properties.owner_id", uid),
      admin.from("locacoes").select("id").eq("tenant_id", uid),
      admin.from("locacoes").select("id, properties!inner(owner_id)").eq("properties.owner_id", uid),
    ]);
    if ([tC, oC, tL, oL].some((r) => r.error)) return { temHistorico: true, temAtivo: true };
    const contratos = [...(tC.data ?? []), ...(oC.data ?? [])] as { status?: string }[];
    const locacoes = [...(tL.data ?? []), ...(oL.data ?? [])];
    return {
      temHistorico: contratos.length > 0 || locacoes.length > 0,
      temAtivo: contratos.some((c) => c.status === "ativo"),
    };
  } catch {
    return { temHistorico: true, temAtivo: true };
  }
}

async function ipDoPedido(): Promise<string> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || "desconhecido";
  } catch {
    return "desconhecido";
  }
}

/**
 * Passo 1 — pede a exclusão. Resposta SEMPRE neutra (anti-enumeração): não revela
 * se existe conta com aquele e-mail. Se existir, envia o link de confirmação.
 */
export async function solicitarExclusaoConta(email: string): Promise<{ ok: boolean }> {
  const mensagemNeutra = { ok: true };
  if (!isValidEmail(email)) return { ok: false };
  const e = normalizarEmail(email);

  const admin = createAdminClient();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!admin || !secret) return mensagemNeutra; // demo/sem servidor: não vaza nada

  try {
    const emailHash = hashSeguro("email", e, secret);
    const ipHash = hashSeguro("ip", await ipDoPedido(), secret);
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Limite por e-mail e por IP (conta TODOS os pedidos, com ou sem conta).
    // Sem a tabela (0055 não aplicada) ou com erro: NÃO envia (falha fechada).
    const [porEmail, porIp] = await Promise.all([
      admin.from("exclusao_conta_pedidos").select("id", { count: "exact", head: true })
        .eq("email_hash", emailHash).gte("criado_em", umaHoraAtras),
      admin.from("exclusao_conta_pedidos").select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash).gte("criado_em", umaHoraAtras),
    ]);
    if (porEmail.error || porIp.error) {
      console.error("[excluir-conta] limite indisponível:", porEmail.error?.message ?? porIp.error?.message);
      return mensagemNeutra;
    }
    if ((porEmail.count ?? 0) >= LIMITE_POR_EMAIL_HORA || (porIp.count ?? 0) >= LIMITE_POR_IP_HORA) {
      return mensagemNeutra;
    }

    // Conta pelo e-mail EXATO (auth.users), nunca por padrão/coringa.
    const { data: uid, error: rpcErr } = await admin.rpc("uid_por_email_exato", { e });
    if (rpcErr) {
      console.error("[excluir-conta] busca da conta falhou:", rpcErr.message);
      return mensagemNeutra;
    }

    const { data: pedido, error: insErr } = await admin
      .from("exclusao_conta_pedidos")
      .insert({ uid: (uid as string | null) ?? null, email_hash: emailHash, ip_hash: ipHash })
      .select("id")
      .single();
    if (insErr || !pedido) {
      console.error("[excluir-conta] falha ao registrar pedido:", insErr?.message);
      return mensagemNeutra;
    }

    if (uid) {
      const token = criarTokenExclusao({ j: pedido.id as string, u: uid as string, e }, secret);
      const url = `${SITE_URL}/excluir-conta/confirmar?token=${encodeURIComponent(token)}`;
      const title = "Confirme a exclusão da sua conta";
      const intro =
        "Recebemos um pedido para excluir sua conta no Viva Nomads. Se foi você, confirme " +
        "no botão abaixo. O link vale por 30 minutos e só pode ser usado uma vez. Se não " +
        "foi você, ignore este e-mail — nada será apagado.";
      await sendEmail({
        to: e,
        subject: title,
        html: brandedNotification({
          title,
          intro,
          cta: { label: "Confirmar exclusão da conta", url },
        }),
        text: notificationText({ title, intro, cta: { label: "Confirmar exclusão", url } }),
      }).catch(() => {});
    }
  } catch {
    /* best-effort — resposta neutra de qualquer forma */
  }
  return mensagemNeutra;
}

/**
 * Passo 2 — confirma e APAGA. Chamado por um clique explícito na página de
 * confirmação (nunca no carregamento, para scanners de e-mail não dispararem).
 */
export async function confirmarExclusaoConta(
  token: string
): Promise<{ ok: boolean; error?: string; blocked?: boolean; anonymized?: boolean }> {
  const admin = createAdminClient();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!admin || !secret) return { ok: false, error: "Serviço indisponível no momento." };

  const invalido = { ok: false, error: "Link inválido, expirado ou já usado. Peça um novo." };
  const t = lerTokenExclusao(token, secret);
  if (!t) return invalido;

  try {
    // USO ÚNICO: marca o pedido como usado de forma atômica (só passa uma vez,
    // dentro dos 30 min e para o mesmo uid do token).
    const limite = new Date(Date.now() - EXCLUSAO_TTL_S * 1000).toISOString();
    const { data: usado, error: usoErr } = await admin
      .from("exclusao_conta_pedidos")
      .update({ usado_em: new Date().toISOString() })
      .eq("id", t.j)
      .eq("uid", t.u)
      .is("usado_em", null)
      .gte("criado_em", limite)
      .select("id");
    if (usoErr || !usado || usado.length !== 1) return invalido;

    // A conta ainda é a do link: o e-mail ATUAL do uid tem que ser exatamente o do token.
    const { data: conta, error: contaErr } = await admin.auth.admin.getUserById(t.u);
    if (contaErr || !conta?.user) return { ok: true }; // já não existe: idempotente
    if (normalizarEmail(conta.user.email ?? "") !== t.e) return invalido;
    const uid = t.u;

    const { temHistorico, temAtivo } = await situacaoContratos(admin, uid);

    // (1) Locação/contrato ATIVO → bloqueia (encerre antes).
    if (temAtivo) {
      return {
        ok: false,
        blocked: true,
        error:
          "Você tem uma locação ou contrato ativo. Encerre a locação antes de excluir a conta — " +
          "assim preservamos os registros exigidos enquanto o contrato está em vigor.",
      };
    }

    // (2) Histórico de contratos → ANONIMIZA (retenção legal), não apaga.
    // Depende da migração 0049 (função anonimizar_conta). Se ela ainda não foi
    // aplicada, NÃO cai no apagar em cascata: bloqueia com orientação.
    if (temHistorico) {
      const { error } = await admin.rpc("anonimizar_conta", { target: uid });
      if (error) {
        return {
          ok: false,
          error:
            "No momento não é possível excluir contas com histórico de contratos por aqui. " +
            "Fale conosco pelos canais oficiais para concluir.",
        };
      }
      return { ok: true, anonymized: true };
    }

    // (3) Sem contratos → apaga de fato (auth.users → cascata).
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) return { ok: false, error: "Não foi possível excluir agora. Tente novamente." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível excluir agora. Tente novamente." };
  }
}
