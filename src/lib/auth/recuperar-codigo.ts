/*
  E917 (opção A) — regras PURAS da recuperação por código (contas de teste). O código é o OTP recovery do Supabase:
  6 dígitos, a mesma validade do código de acesso e uso único (quem decide vencido/usado é o Supabase, no verifyOtp).
*/
export const MSG_CODIGO_RECUPERACAO_INVALIDO = "Código inválido, vencido ou já usado. Peça um novo em \"Esqueci minha senha\".";

export function codigoRecuperacaoValido(codigo: string): boolean {
  return /^\d{6}$/.test(codigo);
}

/*
  E917 (correção da prova de 19/11): na conta de TESTE o código aparece NA TELA de /auth/reset/codigo — a opção A vive
  dessa exibição. A "caixa de teste" só se lê com sessão, e quem esqueceu a senha não tem sessão; por isso a rota devolve
  o código (só para profiles.is_teste) e o /auth passa-o à tela seguinte pelo sessionStorage (nunca pela URL).
*/
export const CHAVE_CODIGO_TELA = "vn-recuperar-codigo";
/** O código guardado vale o mesmo que o código no Supabase (10 minutos). */
export const VALIDADE_CODIGO_TELA_MS = 10 * 60_000;

export function guardarCodigoTela(email: string, codigo: string, agora: number): string {
  return JSON.stringify({ e: email.trim().toLowerCase(), c: codigo, t: agora });
}

/** O código a mostrar na tela: só para o MESMO e-mail, com 6 dígitos e dentro da validade. Senão, null. */
export function codigoParaTela(guardado: string | null, email: string, agora: number): string | null {
  if (!guardado) return null;
  try {
    const g = JSON.parse(guardado) as { e?: unknown; c?: unknown; t?: unknown };
    if (typeof g.e !== "string" || typeof g.c !== "string" || typeof g.t !== "number") return null;
    if (g.e !== email.trim().toLowerCase() || !codigoRecuperacaoValido(g.c)) return null;
    if (agora - g.t < 0 || agora - g.t > VALIDADE_CODIGO_TELA_MS) return null;
    return g.c;
  } catch {
    return null;
  }
}
