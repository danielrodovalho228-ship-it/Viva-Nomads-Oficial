/*
  E445 (item 3) — detector de ofensas do chat. PURO (servidor e eco do cliente). Compara o texto normalizado (sem
  acento, minúsculas, letras repetidas encurtadas) com a lista versionada, sempre por palavra inteira: "corno" não casa
  com "cornucópia"; uma expressão casa só com a sequência exata de palavras.
*/
import { TERMOS_OFENSIVOS } from "../../config/ofensas.ts";

export const AVISO_OFENSA =
  "Sua mensagem tem um termo ofensivo. Conversas na Viva Nomads seguem o respeito — revise antes de enviar. Se enviar mesmo assim, a equipe será avisada.";

/** Quantos registros na fila (30 dias) fazem a equipe ser avisada. */
export const LIMITE_AVISO_ADMIN = 3;

export function normalizarParaOfensa(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const PADROES = TERMOS_OFENSIVOS.map((t) => ({ termo: t, re: new RegExp(`(?:^| )${normalizarParaOfensa(t)}(?= |$)`) }));

/** O primeiro termo ofensivo encontrado (da lista), ou null. */
export function termoOfensivo(texto: string): string | null {
  const n = normalizarParaOfensa(texto);
  if (!n) return null;
  for (const p of PADROES) if (p.re.test(n)) return p.termo;
  return null;
}
