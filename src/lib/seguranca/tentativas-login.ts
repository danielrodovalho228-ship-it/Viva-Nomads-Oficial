/*
  Tentativas de login (F44) — regras PURAS e testáveis.
  Contagem de falhas por e-mail neste navegador; a trava de verdade (por conta/IP)
  continua no Supabase Auth (rate limit + CAPTCHA). Aqui: atraso progressivo e
  captcha obrigatório depois de 3 falhas, sem revelar se o e-mail existe.
*/

export const FALHAS_PARA_CAPTCHA = 3;
const ESPERA_MAX_S = 60;

/** Captcha obrigatório a partir da 3ª falha seguida na mesma conta. */
export function exigeCaptchaPorFalhas(falhas: number): boolean {
  return falhas >= FALHAS_PARA_CAPTCHA;
}

/** Espera antes de nova tentativa: 0 até 2 falhas; depois 5, 10, 20, 40 e no máximo 60 s. */
export function esperaSegundos(falhas: number): number {
  if (falhas < FALHAS_PARA_CAPTCHA) return 0;
  return Math.min(ESPERA_MAX_S, 5 * 2 ** (falhas - FALHAS_PARA_CAPTCHA));
}

export function chaveFalhas(email: string): string {
  return `vn:login-falhas:${email.trim().toLowerCase()}`;
}

export interface EstadoFalhas {
  falhas: number;
  ultima: number;
}

/** Quanto falta (em s) para liberar nova tentativa. */
export function segundosRestantes(e: EstadoFalhas, agora: number): number {
  const resta = esperaSegundos(e.falhas) - Math.floor((agora - e.ultima) / 1000);
  return resta > 0 ? resta : 0;
}

export function lerFalhas(armazenado: string | null): EstadoFalhas {
  try {
    const j = JSON.parse(armazenado ?? "") as Partial<EstadoFalhas>;
    if (typeof j.falhas === "number" && typeof j.ultima === "number" && j.falhas >= 0) {
      return { falhas: Math.floor(j.falhas), ultima: j.ultima };
    }
  } catch {
    /* sem registro válido */
  }
  return { falhas: 0, ultima: 0 };
}

export const MSG_LOGIN_FALHOU = "E-mail ou senha incorretos.";
