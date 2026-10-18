/*
  VERIFICAÇÃO DE TELEFONE (prompt 7) — regras puras, sem Supabase.
  O código por SMS é o nativo do Supabase Auth (updateUser + verifyOtp 'phone_change'); aqui só ficam
  máscara/validação do celular BR, limites de envio, espera do "Reenviar" e a regra do selo.
  O número nunca vai para log, URL, perfil público ou cartão: só o selo "Telefone verificado".
*/

/** DDDs válidos no Brasil (Anatel). */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53,
  54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96,
  97, 98, 99,
]);

/** Só os dígitos do celular (sem o +55): aceita colar "+55 (34) 99999-0000". Máximo 11. */
export function digitosCelular(entrada: string): string {
  let d = (entrada ?? "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.slice(0, 11);
}

/** Máscara progressiva (XX) 9XXXX-XXXX enquanto a pessoa digita. */
export function mascaraCelular(entrada: string): string {
  const d = digitosCelular(entrada);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const ERRO_NUMERO = "Número inválido. Use o DDD e os 9 dígitos do celular, por exemplo (34) 99999-0000.";
export const ERRO_CODIGO = "Código errado ou expirado. Confira os 6 dígitos ou peça um novo código.";
export const ERRO_LIMITE = "Muitos códigos pedidos. Tente de novo mais tarde.";
export const ERRO_NUMERO_EM_USO = "Não foi possível usar este número. Confira o número ou use outro.";
export const ERRO_INDISPONIVEL = "Verificação de telefone em breve.";

export type CelularValidado = { ok: true; e164: string } | { ok: false; erro: string };

/** Celular BR: DDD válido + 9 dígitos começando com 9. Devolve E.164 sem "+" ("5534999990000"), como o Supabase guarda. */
export function validarCelularBR(entrada: string): CelularValidado {
  const d = digitosCelular(entrada);
  if (d.length !== 11) return { ok: false, erro: ERRO_NUMERO };
  if (!DDDS.has(Number(d.slice(0, 2)))) return { ok: false, erro: ERRO_NUMERO };
  if (d[2] !== "9") return { ok: false, erro: ERRO_NUMERO };
  if (/^(\d)\1+$/.test(d.slice(3))) return { ok: false, erro: ERRO_NUMERO };
  return { ok: true, e164: `55${d}` };
}

/** Código de 6 dígitos (o que vier além disso é ignorado; letras são removidas). */
export function limparCodigo(entrada: string): string {
  return (entrada ?? "").replace(/\D/g, "").slice(0, 6);
}

export function codigoValido(entrada: string): boolean {
  return /^\d{6}$/.test(entrada ?? "");
}

/** "Reenviar" só depois de 60 s. Devolve os segundos que faltam (0 = pode reenviar). */
export const ESPERA_REENVIO_S = 60;
export function segundosParaReenviar(enviadoEmMs: number | null, agoraMs: number): number {
  if (enviadoEmMs == null) return 0;
  return Math.max(0, Math.ceil((enviadoEmMs + ESPERA_REENVIO_S * 1000 - agoraMs) / 1000));
}

/** Limites de envio por usuário E por IP: 3 por hora e 5 por dia (prompt 7). */
export const LIMITES_SMS = [
  { sufixo: "h", maximo: 3, janelaSegundos: 60 * 60 },
  { sufixo: "d", maximo: 5, janelaSegundos: 24 * 60 * 60 },
] as const;

/** Chaves do limitador (src/lib/limites): uma por usuário e uma por IP (hash), em cada janela. Nunca o número. */
export function chavesLimiteSms(userId: string, ipHash: string): { chave: string; maximo: number; janelaSegundos: number }[] {
  return LIMITES_SMS.flatMap((l) => [
    { chave: `sms:u:${userId}:${l.sufixo}`, maximo: l.maximo, janelaSegundos: l.janelaSegundos },
    { chave: `sms:ip:${ipHash}:${l.sufixo}`, maximo: l.maximo, janelaSegundos: l.janelaSegundos },
  ]);
}

/**
 * Selo "Telefone verificado": o Supabase confirmou o número (phone_confirmed_at) E a verificação registrada
 * pela Viva é deste número — pedir código para outro número zera o registro (verificadoEm = null) até
 * confirmar de novo.
 */
export function seloTelefone(p: { phoneConfirmedAt: string | null | undefined; verificadoEm: string | null | undefined }): boolean {
  return !!p.phoneConfirmedAt && !!p.verificadoEm;
}

/** O Supabase está pronto para mandar SMS de verdade? (GET /auth/v1/settings) Autoconfirmação ligada = NÃO: confirmaria sem código. */
export function provedorSmsPronto(s: { external?: { phone?: boolean } | null; sms_provider?: string | null; phone_autoconfirm?: boolean | null } | null): boolean {
  return !!s && s.external?.phone === true && !!s.sms_provider && s.phone_autoconfirm !== true;
}

/** Código fixo do modo simulado (SÓ laboratório, INTEGRACOES_SIMULADAS; nunca em produção). */
export const CODIGO_SIMULADO = "123456";
