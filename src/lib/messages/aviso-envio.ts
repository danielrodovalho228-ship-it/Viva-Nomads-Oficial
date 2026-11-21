/**
 * E445 item 2 — aviso ANTES de enviar. A tela usa a MESMA máscara do servidor (guardContactInfo), então a prévia é
 * exatamente o que será gravado. O servidor continua mascarando (fonte da verdade): este aviso só avisa antes.
 *
 * - "livre": nada a proteger, envia direto.
 * - "confirmar": havia contato/link de contato; a pessoa vê o aviso e a prévia mascarada e escolhe Editar ou Enviar
 *   mesmo assim (que envia a versão MASCARADA — o contato nunca é liberado).
 * - E963: o convite para um mensageiro ("me chama no zap") sem número também pede "confirmar", com o texto inteiro na prévia.
 * - "documento": CPF/RG não vai pelo chat (Prompt 32), continua bloqueado.
 */
import { guardContactInfo } from "./contact-guard.ts";

export type AvisoEnvio = { tipo: "livre"; texto: string } | { tipo: "confirmar"; previa: string } | { tipo: "documento" };

/**
 * E963 — o CONVITE para um mensageiro fora da plataforma abre o aviso mesmo SEM número: não há o que mascarar, a prévia é
 * o próprio texto e o envio só sai pelo "Enviar mesmo assim". Convite (decisão do Gerente, ORDEM-DUET-072):
 *  • verbo de contato + mensageiro: "me chama no zap", "chama no whats", "fala comigo no WhatsApp", "me add no zapzap";
 *  • pedido do mensageiro do outro: "tem whats?", "qual seu zap?", "me passa seu whats".
 * A menção negada ou declarativa ("aqui não uso WhatsApp", "não me chama no zap") não abre: é o contrário do convite.
 * Palavra inteira: "Zapata", "zelador" não contam.
 */
const MENSAGEIRO = "(?:zap(?:zap|p)?|whats(?:app?)?|wpp|telegram)";
const FIM = "(?![\\p{L}\\d])";
const INICIO = "(?<![\\p{L}\\d])";
const VERBO_CONTATO =
  "(?:chama|chame|chamar|fala|fale|falar|falamos|conversa|converse|conversar|conversamos|manda|mande|mandar|liga|ligue|ligar|add|adiciona|adicione|adicionar|segue|siga|continua|continue|continuamos|me\\s+acha|me\\s+encontra)";
const CONVITE_RE = new RegExp(`${INICIO}${VERBO_CONTATO}${FIM}[^.!?\\n]{0,30}?${INICIO}${MENSAGEIRO}${FIM}`, "iu");
const PEDIDO_RE = new RegExp(`${INICIO}(?:tem|qual\\s+(?:é\\s+)?(?:o\\s+)?(?:seu|teu)|(?:me\\s+)?passa\\s+(?:o\\s+)?(?:seu|teu)|seu|teu)\\s+${MENSAGEIRO}${FIM}`, "iu");
/** "não" logo antes do convite (até 2 palavras) desfaz o convite: "não me chama no zap". */
const NEGADO_RE = /(?<![\p{L}\d])n[ãa]o(?:\s+\p{L}+){0,2}\s*$/iu;

export function convidaParaMensageiro(texto: string): boolean {
  for (const re of [CONVITE_RE, PEDIDO_RE]) {
    const m = re.exec(texto);
    if (m && !NEGADO_RE.test(texto.slice(0, m.index))) return true;
  }
  return false;
}

export function avisoAntesDeEnviar(rascunho: string): AvisoEnvio {
  const { text, masked, documento } = guardContactInfo(rascunho);
  if (documento) return { tipo: "documento" };
  if (masked || convidaParaMensageiro(text)) return { tipo: "confirmar", previa: text };
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
