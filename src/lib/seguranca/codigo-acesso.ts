/*
  Entrar com código por e-mail (ordem d250ea2f, item 4) — regras PURAS e testáveis.
  O código de 6 dígitos vem do Supabase Auth (modelo "Magic link" → {{ .Token }}); a trava de verdade
  (limite por e-mail/IP, validade) continua lá. Aqui: formato, espera para reenviar e teto de tentativas
  neste navegador, sem revelar se o e-mail tem conta.
*/

export const TAMANHO_CODIGO = 6;
export const ESPERA_REENVIO_S = 60;
export const MAX_TENTATIVAS_CODIGO = 5;

/** Só dígitos, no máximo 6 (aceita colar "123 456" ou "123-456"). */
export function normalizarCodigo(bruto: string): string {
  return bruto.replace(/\D/g, "").slice(0, TAMANHO_CODIGO);
}

export function codigoCompleto(codigo: string): boolean {
  return new RegExp(`^\\d{${TAMANHO_CODIGO}}$`).test(codigo);
}

/** Quanto falta (em s) para liberar o reenvio do código. */
export function segundosParaReenviar(enviadoEm: number, agora: number): number {
  const resta = ESPERA_REENVIO_S - Math.floor((agora - enviadoEm) / 1000);
  return resta > 0 ? resta : 0;
}

export function tentativasRestantes(erradas: number): number {
  return Math.max(0, MAX_TENTATIVAS_CODIGO - erradas);
}

/**
 * Pedir o código nunca revela se o e-mail existe: "conta inexistente" do Supabase vira sucesso
 * silencioso (shouldCreateUser=false); só limite de envios e falha de rede aparecem para a pessoa.
 */
export function mensagemEnvioCodigo(erro: string): string | null {
  const m = erro.toLowerCase();
  if (m.includes("signups not allowed") || m.includes("user not found")) return null;
  if (m.includes("rate limit") || m.includes("too many") || m.includes("seconds")) {
    return "Muitos pedidos de código. Aguarde um minuto e tente de novo.";
  }
  if (m.includes("captcha")) return "Confirme que você não é um robô e tente de novo.";
  return "Não foi possível enviar o código agora. Tente novamente em instantes.";
}

export function mensagemVerificarCodigo(erro: string): string {
  const m = erro.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde um minuto e tente de novo.";
  if (m.includes("expired") || m.includes("invalid")) return "Código incorreto ou vencido. Confira os 6 dígitos ou peça um novo código.";
  return "Não foi possível entrar com o código agora. Tente novamente em instantes.";
}
