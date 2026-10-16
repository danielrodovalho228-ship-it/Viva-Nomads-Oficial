/*
  Verificação do Turnstile no SERVIDOR (chamado deslogado, ordem 8e720f03).
  Só exige o token quando as duas chaves existem: a pública (widget aparece) e
  a secreta TURNSTILE_SECRET_KEY (Vercel). Sem a secreta não dá para verificar:
  libera, como o login faz sem a chave pública.
*/
export const MSG_CAPTCHA_RECUSADO = "Não conseguimos confirmar que você não é um robô. Atualize a verificação e tente de novo.";

type Fetcher = (url: string, init: { method: string; body: URLSearchParams }) => Promise<{ json(): Promise<unknown> }>;

export async function verificarCaptchaServidor(
  token: string | null | undefined,
  opcoes: { chavePublica?: string; segredo?: string; ip?: string; fetcher?: Fetcher } = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const chavePublica = opcoes.chavePublica?.trim();
  const segredo = opcoes.segredo?.trim();
  if (!chavePublica || !segredo) return { ok: true };
  const t = (token ?? "").trim();
  if (t.length < 10 || t.length > 4096) return { ok: false, error: MSG_CAPTCHA_RECUSADO };
  const corpo = new URLSearchParams({ secret: segredo, response: t });
  if (opcoes.ip) corpo.set("remoteip", opcoes.ip);
  try {
    const r = await (opcoes.fetcher ?? fetch)("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: corpo });
    const j = (await r.json()) as { success?: boolean };
    return j?.success === true ? { ok: true } : { ok: false, error: MSG_CAPTCHA_RECUSADO };
  } catch {
    return { ok: false, error: MSG_CAPTCHA_RECUSADO };
  }
}
