/**
 * E445 item 2 — aviso ANTES de enviar. A tela usa a MESMA máscara do servidor (guardContactInfo), então a prévia é
 * exatamente o que será gravado. O servidor continua mascarando (fonte da verdade): este aviso só avisa antes.
 *
 * - "livre": nada a proteger, envia direto.
 * - "confirmar": havia contato/link de contato; a pessoa vê o aviso e a prévia mascarada e escolhe Editar ou Enviar
 *   mesmo assim (que envia a versão MASCARADA — o contato nunca é liberado).
 * - E963: citar um mensageiro (zap, whats, telegram…) sem número também pede "confirmar", com o texto inteiro na prévia.
 * - "documento": CPF/RG não vai pelo chat (Prompt 32), continua bloqueado.
 */
import { guardContactInfo } from "./contact-guard.ts";

export type AvisoEnvio = { tipo: "livre"; texto: string } | { tipo: "confirmar"; previa: string } | { tipo: "documento" };

/**
 * E963 — citar um mensageiro fora da plataforma ("me chama no zap", whats, WhatsApp, wpp, zapzap, telegram) abre o aviso
 * mesmo SEM número: não há o que mascarar, a prévia é o próprio texto e o envio só sai pelo "Enviar mesmo assim".
 * Palavra inteira: "Zapata", "zelador" não contam.
 */
const MENSAGEIRO_RE = /(?<![\p{L}\d])(?:zap(?:zap|p)?|whats(?:app?)?|wpp|telegram)(?![\p{L}\d])/iu;
export const citaMensageiro = (texto: string): boolean => MENSAGEIRO_RE.test(texto);

export function avisoAntesDeEnviar(rascunho: string): AvisoEnvio {
  const { text, masked, documento } = guardContactInfo(rascunho);
  if (documento) return { tipo: "documento" };
  if (masked || citaMensageiro(text)) return { tipo: "confirmar", previa: text };
  return { tipo: "livre", texto: text };
}

/**
 * E585 — a prévia mascarada AO DIGITAR (a mesma da proposta, antes do envio): com contato no rascunho, devolve o texto
 * como vai ser gravado; sem contato, vazio ou vindo de resposta rápida (lá o contato é bloqueado, 55-E2), null.
 */
export function previaAoDigitar(rascunho: string, opts: { deRapida?: boolean } = {}): string | null {
  if (!rascunho.trim() || opts.deRapida) return null;
  const a = avisoAntesDeEnviar(rascunho);
  return a.tipo === "confirmar" ? a.previa : null;
}
