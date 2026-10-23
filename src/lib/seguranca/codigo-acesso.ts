/*
  Entrar com código por e-mail (ordem d250ea2f, item 4; Prompt 49: entrada única) — regras PURAS e testáveis.
  O código de 6 dígitos vem do Supabase Auth (modelos "Magic link" e "Confirm signup" → {{ .Token }}) e vale
  10 minutos (mailer_otp_exp). O envio passa por /api/auth/codigo, que limita 5 envios por hora por e-mail e
  por IP e responde igual com ou sem conta (a conta nova nasce no 1º código). Aqui: formato, validade, espera
  para reenviar, teto de tentativas neste navegador e os limites de envio.
*/

export const TAMANHO_CODIGO = 6;
export const ESPERA_REENVIO_S = 60;
export const MAX_TENTATIVAS_CODIGO = 5;
/** Validade do código (s): espelha mailer_otp_exp do Supabase, aplicado pela Action dos e-mails de conta. */
export const VALIDADE_CODIGO_S = 600;
/** Teto de envios de código por hora, por e-mail e por IP (contados no servidor). */
export const MAX_ENVIOS_HORA = 5;
export const JANELA_ENVIOS_S = 3600;
/** Conta criada há menos que isto, entrando pelo código, é "conta nova" (vê a tela de intenção). */
export const JANELA_CONTA_NOVA_S = 30 * 60;

export const MSG_CODIGO_VENCIDO = "Código vencido: enviamos um novo para o seu e-mail.";
export const MSG_MUITOS_ENVIOS = "Muitos pedidos de código. Aguarde um pouco e tente de novo.";

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

/** O código enviado em `enviadoEm` (ms) já passou da validade? */
export function codigoVencido(enviadoEm: number, agora: number): boolean {
  return agora - enviadoEm >= VALIDADE_CODIGO_S * 1000;
}

/** Conta criada agora (pelo 1º código): created_at dentro da janela. Data inválida → não é nova. */
export function contaNova(criadaEm: string | null | undefined, agora: number): boolean {
  const t = criadaEm ? Date.parse(criadaEm) : NaN;
  return Number.isFinite(t) && agora - t >= 0 && agora - t < JANELA_CONTA_NOVA_S * 1000;
}

export type SituacaoLimite = "ok" | "estourou" | "erro";
export type Limitar = (chave: string, maximo: number, janelaSegundos: number) => Promise<SituacaoLimite>;

/**
 * Pode enviar mais um código? Consome 1 do e-mail e 1 do IP (5 por hora cada). Infra do limitador fora do ar
 * não tranca ninguém (falha aberta, como o login; o Supabase mantém o limite dele).
 */
export async function avaliarEnvioCodigo(emailHash: string, ipHashValor: string, limitar: Limitar): Promise<boolean> {
  const porEmail = await limitar(`codigo:email:${emailHash}`, MAX_ENVIOS_HORA, JANELA_ENVIOS_S);
  const porIp = await limitar(`codigo:ip:${ipHashValor}`, MAX_ENVIOS_HORA, JANELA_ENVIOS_S);
  return porEmail !== "estourou" && porIp !== "estourou";
}

export function tentativasRestantes(erradas: number): number {
  return Math.max(0, MAX_TENTATIVAS_CODIGO - erradas);
}

/**
 * Pedir o código nunca revela se o e-mail existe: a conta nova nasce no envio (shouldCreateUser=true) e um
 * "conta inexistente"/"cadastro fechado" do Supabase vira sucesso silencioso; só limite de envios, CAPTCHA e
 * falha de rede aparecem para a pessoa.
 */
export function mensagemEnvioCodigo(erro: string): string | null {
  const m = erro.toLowerCase();
  if (m.includes("signups not allowed") || m.includes("user not found")) return null;
  if (m.includes("rate limit") || m.includes("too many") || m.includes("seconds")) {
    return MSG_MUITOS_ENVIOS;
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
