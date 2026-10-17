/**
 * Detector de "texto que não devia aparecer na tela" (ordem 0569d129, itens 2, 3, 5 e 6).
 * Puro: recebe o texto visível de uma tela e devolve o que está errado. Usado pelo spec t118 do laboratório
 * e testado em src/lib/varredura-texto.test.ts. Nunca recebe dado de pessoa: só o texto da tela.
 */
import { COMPARE_RODAPE, DIFERENCIAIS_VIVA, LINHAS_COMPARE } from "../config/compare-precos.ts";

/**
 * Exceção da tabela comparativa Viva × Airbnb × QuintoAndar (src/config/compare-precos.ts). Por regra
 * permanente do Daniel a tabela é intocável e é a ÚNICA fonte autorizada a manter termos que a varredura
 * barraria (ex.: "check-in" em "Sem faxina nem check-in toda semana"). Os textos vindos desse arquivo
 * saem da tela antes da varredura; o mesmo termo em qualquer outro lugar continua reprovado.
 */
const TEXTOS_DA_TABELA: readonly string[] = [
  COMPARE_RODAPE,
  ...DIFERENCIAIS_VIVA,
  ...LINHAS_COMPARE.flatMap((l) => [l.nome, l.regra, l.nota ?? "", l.fonte?.nome ?? ""]),
].filter((t) => t.trim().length >= 12);

export function semTabelaComparativa(texto: string): string {
  let out = texto;
  for (const t of TEXTOS_DA_TABELA) out = out.split(t).join(" ");
  return out;
}

const TERMOS_PROIBIDOS: Array<[string, RegExp]> = [
  ["aluguel", /\balugu[eé](?:l|is)\b/i],
  ["comissão", /\bcomiss(?:ão|ões|ao|oes)\b/i],
  ["vistoria", /\bvistorias?\b/i],
  ["corretagem", /\bcorretagem\b/i],
  ["intermediação", /\bintermedia(?:ção|çao|cao)\b|\bintermedeia\b/i],
  ["temporada", /\btemporada\b/i],
  ["art. 48", /\bart\.?\s*48\b/i],
];

/** Vocabulário de hospedagem/reserva que não vale nas páginas públicas (ordem 8652162e): somos locação mobiliada. */
const VOCABULARIO_PUBLICO: Array<[string, RegExp]> = [
  ["hóspede", /\bh[óo]spedes?\b/i],
  ["check-in/out", /\bcheck[- ]?(?:in|out)\b/i],
  ["reserva", /\breservas?\b/i],
  ["quem se hospeda", /\bse hospeda\b/i],
];

/** Citação de lei na tela de publicar imóvel (ordem b68f4ede, prova do #650): o dono não vê "Lei 8.245", "art. 38" nem "art. 13". */
const CITACAO_DE_LEI: Array<[string, RegExp]> = [
  ["Lei 8.245", /\b8\.?245\b/],
  ["art. 38", /\bart\.?\s*38\b/i],
  ["art. 13", /\bart\.?\s*13\b/i],
];

/** Telas onde a citação de lei é proibida (publicar imóvel). */
export function rotaVarreLeis(rota: string): boolean {
  return /^\/dashboard\/imoveis\/novo(\/|$)/.test(rota.split(/[?#]/)[0]);
}

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

/** Vocabulário público só vale em página pública (fora painel, admin, contrato, /termos, /privacidade e /seguranca). */
export function rotaVarreVocabulario(rota: string): boolean {
  const caminho = rota.split(/[?#]/)[0];
  return rotaVarreTermos(rota) && !/^\/(dashboard|admin|seguranca)(\/|$)/.test(caminho);
}

export function achadosNoTexto(texto: string, opcoes: { termos?: boolean; vocabulario?: boolean; leis?: boolean } = {}): string[] {
  const out: string[] = [];
  if (opcoes.leis) {
    for (const [nome, re] of CITACAO_DE_LEI) {
      const m = re.exec(texto);
      if (m) out.push(`citação de lei "${nome}": …${trecho(texto, m.index)}…`);
    }
  }
  if (opcoes.vocabulario) {
    for (const [nome, re] of VOCABULARIO_PUBLICO) {
      const m = re.exec(texto);
      if (m) out.push(`vocabulário de hospedagem "${nome}": …${trecho(texto, m.index)}…`);
    }
  }
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

/**
 * Metas de uma página (description, og:title/description, twitter:title/description) entram na varredura
 * de termos como se fossem texto da tela (ordem 7816ce3a, parte 2). Vazias e repetidas são ignoradas.
 */
export function achadosNasMetas(metas: Array<string | null | undefined>, opcoes: { termos?: boolean; vocabulario?: boolean; leis?: boolean } = {}): string[] {
  const textos = [...new Set(metas.map((m) => (m ?? "").trim()).filter(Boolean))];
  return textos.flatMap((t) => achadosNoTexto(t, opcoes).map((a) => `meta: ${a}`));
}

/** Meta description acima de 155 caracteres é cortada no Google (ordem 49c2dbef). */
export function achadoTamanhoDescription(description: string | null | undefined, limite = 155): string[] {
  const n = (description ?? "").trim().length;
  return n > limite ? [`meta: description com ${n} caracteres (limite ${limite})`] : [];
}

/**
 * Foto de imóvel semeado pelo laboratório sem upload real (https://lab.vivanomads.test/…): o Next recusa o host
 * (400 em /_next/image). Não é defeito do site, e o t48 não deve acusá-la.
 */
export function recursoFicticioDoLab(alvo: string | null | undefined): boolean {
  if (!alvo) return false;
  try {
    const u = new URL(alvo);
    if (u.pathname !== "/_next/image") return false;
    return new URL(u.searchParams.get("url") ?? "").hostname === "lab.vivanomads.test";
  } catch {
    return false;
  }
}
