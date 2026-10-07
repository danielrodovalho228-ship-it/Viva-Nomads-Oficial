/*
  CAPTCHA do login (Cloudflare Turnstile) — regras PURAS e testáveis.

  Liga com a chave pública NEXT_PUBLIC_TURNSTILE_SITE_KEY (Vercel) + a chave
  secreta no Supabase (Authentication → Attack Protection → CAPTCHA). Sem a
  chave pública o widget não aparece e nada muda (laboratório, dev e preview).
  ORDEM: primeiro a chave pública no ar, DEPOIS ligar no Supabase — senão o
  Supabase passa a recusar login sem token.
*/

export const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function captchaLigado(chavePublica: string | undefined | null): boolean {
  return !!chavePublica && chavePublica.trim().length > 0;
}

/** Junta o token às opções do Supabase Auth (signUp, signInWithPassword, resetPasswordForEmail, resend). */
export function comCaptcha<T extends object>(opcoes: T, token: string | null): T & { captchaToken?: string } {
  return token ? { ...opcoes, captchaToken: token } : opcoes;
}

/** Com o CAPTCHA ligado, só envia depois do token. */
export function podeEnviar(ligado: boolean, token: string | null): boolean {
  return !ligado || !!token;
}

export const MSG_CAPTCHA_PENDENTE = "Confirme que você não é um robô (logo acima do botão).";

/** O Supabase recusou por CAPTCHA (token faltando, vencido ou já usado). */
export function erroDeCaptcha(mensagem: string): boolean {
  return /captcha/i.test(mensagem);
}
