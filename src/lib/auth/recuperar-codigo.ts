/*
  E917 (opção A) — regras PURAS da recuperação por código (contas de teste). O código é o OTP recovery do Supabase:
  6 dígitos, a mesma validade do código de acesso e uso único (quem decide vencido/usado é o Supabase, no verifyOtp).
*/
export const MSG_CODIGO_RECUPERACAO_INVALIDO = "Código inválido, vencido ou já usado. Peça um novo em \"Esqueci minha senha\".";

export function codigoRecuperacaoValido(codigo: string): boolean {
  return /^\d{6}$/.test(codigo);
}
