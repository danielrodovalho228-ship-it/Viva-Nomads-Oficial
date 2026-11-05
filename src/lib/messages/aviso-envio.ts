/**
 * E445 item 2 — aviso ANTES de enviar. A tela usa a MESMA máscara do servidor (guardContactInfo), então a prévia é
 * exatamente o que será gravado. O servidor continua mascarando (fonte da verdade): este aviso só avisa antes.
 *
 * - "livre": nada a proteger, envia direto.
 * - "confirmar": havia contato/link de contato; a pessoa vê o aviso e a prévia mascarada e escolhe Editar ou Enviar
 *   mesmo assim (que envia a versão MASCARADA — o contato nunca é liberado).
 * - "documento": CPF/RG não vai pelo chat (Prompt 32), continua bloqueado.
 */
import { guardContactInfo } from "./contact-guard.ts";

export type AvisoEnvio = { tipo: "livre"; texto: string } | { tipo: "confirmar"; previa: string } | { tipo: "documento" };

export function avisoAntesDeEnviar(rascunho: string): AvisoEnvio {
  const { text, masked, documento } = guardContactInfo(rascunho);
  if (documento) return { tipo: "documento" };
  if (masked) return { tipo: "confirmar", previa: text };
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
