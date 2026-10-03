"use server";

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { brandedNotification, notificationText } from "@/lib/notifications/templates";
import { SITE_URL } from "@/lib/site";
import { isValidEmail } from "@/lib/auth-errors";

/**
 * Exclusão de conta pela PÁGINA PÚBLICA (/excluir-conta), exigida pela Play Store:
 * funciona SEM login. O usuário informa o e-mail → mandamos um link de confirmação
 * ao DONO do e-mail → ao confirmar (clique explícito, nunca no load), a conta é
 * apagada. A exclusão remove `auth.users` (mesmo efeito de `delete_user_account()`,
 * que o próprio usuário usa dentro do app) e cascateia perfil, imóveis, leads,
 * mensagens, contratos, favoritos, tokens de push, etc.
 *
 * Token: assinado por HMAC com o SERVICE_ROLE_KEY (server-only), com validade de
 * 1h e preso ao e-mail — stateless, não precisa de tabela.
 */

const TOKEN_TTL_S = 60 * 60; // 1 hora

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

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function assinar(payload: string, secret: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(payload).digest());
}

function criarToken(email: string, secret: string): string {
  const payload = b64url(JSON.stringify({ e: email.toLowerCase(), exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S }));
  return `${payload}.${assinar(payload, secret)}`;
}

/** Verifica o token (assinatura + validade) e devolve o e-mail, ou null. */
function lerToken(token: string, secret: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const esperado = assinar(payload, secret);
  // Comparação em tempo constante.
  const a = b64urlDecode(sig);
  const b = b64urlDecode(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { e, exp } = JSON.parse(b64urlDecode(payload).toString("utf8")) as { e: string; exp: number };
    if (!e || !exp || exp < Math.floor(Date.now() / 1000)) return null;
    return e;
  } catch {
    return null;
  }
}

/**
 * Passo 1 — pede a exclusão. Resposta SEMPRE neutra (anti-enumeração): não revela
 * se existe conta com aquele e-mail. Se existir, envia o link de confirmação.
 */
export async function solicitarExclusaoConta(email: string): Promise<{ ok: boolean }> {
  const mensagemNeutra = { ok: true };
  if (!isValidEmail(email)) return { ok: false };

  const admin = createAdminClient();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!admin || !secret) return mensagemNeutra; // demo/sem servidor: não vaza nada

  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("id, full_name")
      .ilike("email", email.trim())
      .maybeSingle();

    if (prof?.id) {
      const token = criarToken(email.trim(), secret);
      const url = `${SITE_URL}/excluir-conta/confirmar?token=${encodeURIComponent(token)}`;
      const title = "Confirme a exclusão da sua conta";
      const intro =
        "Recebemos um pedido para excluir sua conta no Viva Nomads. Se foi você, confirme " +
        "no botão abaixo. O link vale por 1 hora. Se não foi você, ignore este e-mail — " +
        "nada será apagado.";
      await sendEmail({
        to: email.trim(),
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

  const email = lerToken(token, secret);
  if (!email) return { ok: false, error: "Link inválido ou expirado. Peça um novo." };

  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (!prof?.id) return { ok: true }; // já não existe: idempotente
    const uid = prof.id as string;

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
