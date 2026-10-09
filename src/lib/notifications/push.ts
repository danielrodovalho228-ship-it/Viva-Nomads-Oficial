import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXPO_LOTE, EXPO_PUSH_URL, emLotes, lerTickets, montarMensagens, separarTokens } from "./expo-push.ts";

/**
 * Envio de push (Expo Push + FCM HTTP v1) — SERVIDOR apenas, best-effort.
 *
 * Regras (revisão 02/10):
 *  • Tokens "ExponentPushToken[...]" (app Expo) vão ao exp.host e NÃO dependem do FCM;
 *    `EXPO_ACCESS_TOKEN` é opcional. Tokens antigos seguem pelo FCM (`FCM_SERVICE_ACCOUNT_JSON`);
 *    sem a credencial do FCM, só eles são ignorados — nunca quebra.
 *  • O conteúdo NUNCA leva contato, sobrenome nem valores — só o evento + o link.
 *  • Nunca atrasa o `notify()`: timeout curto e falha só vira log.
 *  • Token OAuth do Google em cache (~50 min).
 *  • Resposta UNREGISTERED/404 → apaga o token da tabela (limpa aparelho morto).
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!j.client_email || !j.private_key || !j.project_id) return null;
    // Chaves vindas de env costumam ter \n escapado.
    return { ...j, private_key: j.private_key.replace(/\\n/g, "\n") } as ServiceAccount;
  } catch {
    return null;
  }
}

export function isPushConfigured(): boolean {
  return true; // Expo não precisa de credencial (FCM é opcional)
}

// ── Cache do access token (≈50 min) ──────────────────────────────────────────
let tokenCache: { token: string; exp: number } | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp > now + 60) return tokenCache.token;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claims}`;
  let jwt: string;
  try {
    const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key);
    jwt = `${unsigned}.${base64url(sig)}`;
  } catch (e) {
    console.error("[push] falha ao assinar JWT:", (e as Error).message);
    return null;
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
    if (!res.ok) {
      console.error("[push] token OAuth falhou:", res.status);
      return null;
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    // Cache ~50 min (expires_in ~3600s).
    tokenCache = { token: data.access_token, exp: now + Math.min(data.expires_in ?? 3000, 3000) };
    return data.access_token;
  } catch (e) {
    console.error("[push] token OAuth erro:", (e as Error).message);
    return null;
  }
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
interface Conteudo {
  title: string;
  body: string;
  url?: string;
}

/** Lotes de até 100 para o exp.host; ticket DeviceNotRegistered apaga o token. */
async function enviarExpo(admin: Admin, tokens: string[], c: Conteudo): Promise<number> {
  let sent = 0;
  const msgs = montarMensagens(tokens, c);
  for (const lote of emLotes(msgs, EXPO_LOTE)) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
      if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
      const res = await fetch(EXPO_PUSH_URL, { method: "POST", headers, body: JSON.stringify(lote), signal: ctrl.signal }).finally(
        () => clearTimeout(t)
      );
      if (!res.ok) {
        console.error("[push] expo falhou:", res.status);
        continue;
      }
      const r = lerTickets(lote.map((m) => m.to), await res.json().catch(() => null));
      sent += r.enviados;
      if (r.mortos.length) await admin.from("push_tokens").delete().in("token", r.mortos);
    } catch (e) {
      console.error("[push] expo erro:", (e as Error).message);
    }
  }
  return sent;
}

async function enviarFcm(admin: Admin, sa: ServiceAccount, tokens: string[], c: Conteudo): Promise<number> {
  const accessToken = await getAccessToken(sa);
  if (!accessToken) return 0;

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const data: Record<string, string> = {};
  if (c.url) data.url = c.url;

  let sent = 0;
  await Promise.allSettled(
    tokens.map(async (token) => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: { token, notification: { title: c.title, body: c.body }, data, android: { priority: "HIGH" } },
          }),
          signal: ctrl.signal,
        }).finally(() => clearTimeout(t));

        if (res.ok) {
          sent++;
          return;
        }
        // Token morto → apaga da tabela.
        const txt = await res.text().catch(() => "");
        if (res.status === 404 || /UNREGISTERED|NOT_FOUND/i.test(txt)) {
          await admin.from("push_tokens").delete().eq("token", token);
        } else {
          console.error("[push] envio falhou:", res.status, txt.slice(0, 200));
        }
      } catch (e) {
        console.error("[push] envio erro:", (e as Error).message);
      }
    })
  );
  return sent;
}

/**
 * Envia um push para todos os aparelhos dos usuários. Best-effort e não-bloqueante:
 * o chamador (`notify`) roda isto em paralelo ao e-mail, com timeout próprio.
 * `url` deve ser uma rota interna (validada na origem).
 */
export async function sendPushParaUsuarios(
  userIds: string[],
  params: Conteudo
): Promise<{ sent: number } | { skipped: true }> {
  if (userIds.length === 0) return { skipped: true };
  const admin = createAdminClient();
  if (!admin) return { skipped: true };

  // Tokens dos usuários (service role ignora RLS para ler os destinos).
  const { data: rows, error } = await admin.from("push_tokens").select("token").in("user_id", userIds);
  if (error || !rows || rows.length === 0) return { sent: 0 };

  const { expo, fcm } = separarTokens(rows.map((r: { token: string }) => r.token));
  const sa = serviceAccount();
  const [a, b] = await Promise.all([
    expo.length ? enviarExpo(admin, expo, params) : 0,
    fcm.length && sa ? enviarFcm(admin, sa, fcm, params) : 0,
  ]);
  return { sent: a + b };
}

export async function sendPush(params: { userId?: string } & Conteudo): Promise<{ sent: number } | { skipped: true }> {
  if (!params.userId) return { skipped: true };
  return sendPushParaUsuarios([params.userId], params);
}
