import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Envio de push via FCM HTTP v1 — SERVIDOR apenas, best-effort.
 *
 * Regras (revisão 02/10):
 *  • Credencial só no servidor (`FCM_SERVICE_ACCOUNT_JSON`). Sem ela → no-op, nunca quebra.
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
  return serviceAccount() !== null;
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

/**
 * Envia um push para todos os aparelhos do usuário. Best-effort e não-bloqueante:
 * o chamador (`notify`) roda isto em paralelo ao e-mail, com timeout próprio.
 * `url` deve ser uma rota interna (validada na origem).
 */
export async function sendPush(params: {
  userId?: string;
  title: string;
  body: string;
  url?: string;
}): Promise<{ sent: number } | { demo: true } | { skipped: true }> {
  const sa = serviceAccount();
  if (!sa) return { demo: true }; // sem credencial: no-op silencioso
  if (!params.userId) return { skipped: true };

  const admin = createAdminClient();
  if (!admin) return { skipped: true };

  // Tokens do usuário (service role ignora RLS para ler os destinos).
  const { data: rows, error } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", params.userId);
  if (error || !rows || rows.length === 0) return { sent: 0 };

  const accessToken = await getAccessToken(sa);
  if (!accessToken) return { sent: 0 };

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const data: Record<string, string> = {};
  if (params.url) data.url = params.url;

  let sent = 0;
  await Promise.allSettled(
    rows.map(async (r: { token: string }) => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: r.token,
              notification: { title: params.title, body: params.body },
              data,
              android: { priority: "HIGH" },
            },
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
          await admin.from("push_tokens").delete().eq("token", r.token);
        } else {
          console.error("[push] envio falhou:", res.status, txt.slice(0, 200));
        }
      } catch (e) {
        console.error("[push] envio erro:", (e as Error).message);
      }
    })
  );
  return { sent };
}
