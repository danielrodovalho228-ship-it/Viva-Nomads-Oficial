/**
 * Detector de "texto que não devia aparecer na tela" (ordem 0569d129, itens 2, 3, 5 e 6).
 * Puro: recebe o texto visível de uma tela e devolve o que está errado. Usado pelo spec t118 do laboratório
 * e testado em src/lib/varredura-texto.test.ts. Nunca recebe dado de pessoa: só o texto da tela.
 */

const TERMOS_PROIBIDOS: Array<[string, RegExp]> = [
  ["aluguel", /\balugu[eé](?:l|is)\b/i],
  ["comissão", /\bcomiss(?:ão|ões|ao|oes)\b/i],
  ["vistoria", /\bvistorias?\b/i],
  ["corretagem", /\bcorretagem\b/i],
  ["intermediação", /\bintermedia(?:ção|çao|cao)\b|\bintermedeia\b/i],
  ["temporada", /\btemporada\b/i],
  ["art. 48", /\bart\.?\s*48\b/i],
];

/** Status internos (snake_case com prefixo conhecido) que nunca podem aparecer cruamente. */
const STATUS_CRU = /\b(?:pendente|aguardando|encerrado|removido|em)_[a-z]+(?:_[a-z]+)*\b/g;
const DATA_ISO = /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?\b/;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const VALOR_QUEBRADO = /(?:^|[\s(>:])(undefined|null|NaN)(?=$|[\s).,;:<])/;

/** Caminhos cujo texto aguarda o parecer jurídico (ficam de fora da varredura de termos). */
export const ROTAS_SEM_VARREDURA_DE_TERMOS = [/^\/termos(\/|$)/, /^\/privacidade(\/|$)/, /^\/contratos?\//];

export function rotaVarreTermos(rota: string): boolean {
  const caminho = rota.split(/[?#]/)[0];
  return !ROTAS_SEM_VARREDURA_DE_TERMOS.some((r) => r.test(caminho));
}

function trecho(texto: string, i: number): string {
  return texto.slice(Math.max(0, i - 20), i + 40).replace(/\s+/g, " ").trim();
}

export function achadosNoTexto(texto: string, opcoes: { termos?: boolean } = {}): string[] {
  const out: string[] = [];
  if (opcoes.termos !== false) {
    for (const [nome, re] of TERMOS_PROIBIDOS) {
      const m = re.exec(texto);
      if (m) out.push(`termo proibido "${nome}": …${trecho(texto, m.index)}…`);
    }
  }
  for (const m of texto.matchAll(STATUS_CRU)) out.push(`código de status cru "${m[0]}"`);
  const iso = DATA_ISO.exec(texto);
  if (iso) out.push(`data fora de dd/mm/aaaa: …${trecho(texto, iso.index)}…`);
  const id = UUID.exec(texto);
  if (id) out.push("UUID inteiro na tela (use o código curto de 8 caracteres)");
  const q = VALOR_QUEBRADO.exec(texto);
  if (q) out.push(`valor quebrado "${q[1]}": …${trecho(texto, q.index)}…`);
  return [...new Set(out)];
}
