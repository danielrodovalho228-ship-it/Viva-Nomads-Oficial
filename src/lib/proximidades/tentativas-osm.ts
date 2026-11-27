/*
  E992 — fiabilidade da perna OSM (a lista que se GUARDA para a página pública). PURO.
  • Repetir só o que pode passar numa segunda vez: 429, 5xx, tempo estourado, rede, resposta 200 com "remark" de erro.
    400/403/404 (pedido ou servidor errado) não se repete naquele servidor.
  • Rodízio de servidores: cada rodada passa pelos servidores do Overpass na ordem; entre rodadas, espera crescente
    (1,5 s, 3 s…) — ou o Retry-After do servidor, quando cabe no tempo.
  • Tudo dentro de um ORÇAMENTO de tempo (a perna roda no after() da rota, com maxDuration 60): cada tentativa usa
    no máximo o que resta; sem tempo para mais uma tentativa útil, para e diz que esgotou — falha honesta, nada de
    lista vazia gravada como "nada por perto" e nada vindo do Mapbox.
*/

/** Tempo total da perna OSM no after() (o Nominatim, quando precisa, vem antes e é curto). */
export const ORCAMENTO_OVERPASS_MS = 45_000;
/** Quando a pessoa espera a resposta (caminho sem o Mapbox): o mesmo teto de antes (2 servidores × 20 s). */
export const ORCAMENTO_NA_RESPOSTA_MS = 40_000;
/** Tempo máximo de uma tentativa ao Overpass (a consulta pede [timeout:20]). */
export const TEMPO_MAX_TENTATIVA_MS = 20_000;
/** Abaixo disto não vale a pena tentar: a consulta não termina. */
export const TEMPO_MIN_TENTATIVA_MS = 5_000;
export const RODADAS_OVERPASS = 2;
export const ESPERA_BASE_MS = 1_500;
/** Nominatim: até 2 tentativas por pedido, com 2 s entre elas (a fila de 1 pedido/s continua valendo). */
export const TENTATIVAS_NOMINATIM = 2;
export const ESPERA_NOMINATIM_MS = 2_000;

export type ResultadoTentativa = { status: number } | { erro: string } | { remark: true };

/** Vale repetir (neste ou noutro servidor)? */
export function repetivel(r: ResultadoTentativa): boolean {
  if ("remark" in r) return true;
  if ("erro" in r) return true; // tempo estourado (TimeoutError/AbortError) ou rede
  return r.status === 429 || r.status >= 500;
}

/** A ordem das tentativas: rodada a rodada, todos os servidores; a espera vem ANTES do primeiro de cada nova rodada. */
export function planoOverpass(servidores: readonly string[], rodadas = RODADAS_OVERPASS, esperaBaseMs = ESPERA_BASE_MS): { url: string; rodada: number; esperaAntesMs: number }[] {
  const out: { url: string; rodada: number; esperaAntesMs: number }[] = [];
  for (let r = 0; r < rodadas; r++) {
    servidores.forEach((url, i) => out.push({ url, rodada: r, esperaAntesMs: r > 0 && i === 0 ? esperaBaseMs * 2 ** (r - 1) : 0 }));
  }
  return out;
}

/** Retry-After (segundos ou data HTTP) em ms; null se não veio ou não se entende. */
export function retryAfterMs(cabecalho: string | null | undefined, agora = Date.now()): number | null {
  if (!cabecalho) return null;
  const s = Number(cabecalho.trim());
  if (Number.isFinite(s) && s >= 0) return s * 1000;
  const d = Date.parse(cabecalho);
  return Number.isFinite(d) ? Math.max(0, d - agora) : null;
}

/** Tempo desta tentativa, dado o que resta do orçamento (já descontada a espera); null = não dá mais para tentar. */
export function tempoDaTentativa(restanteMs: number, maxMs = TEMPO_MAX_TENTATIVA_MS, minMs = TEMPO_MIN_TENTATIVA_MS): number | null {
  if (restanteMs < minMs) return null;
  return Math.min(maxMs, restanteMs);
}

/** Espera antes de uma tentativa: a do plano ou, maior, a que o servidor pediu (Retry-After) — se couber no orçamento. */
export function esperaAntes(doPlano: number, pedidaPeloServidor: number | null, restanteMs: number, minMs = TEMPO_MIN_TENTATIVA_MS): number | null {
  const espera = Math.max(doPlano, pedidaPeloServidor ?? 0);
  return restanteMs - espera >= minMs ? espera : null;
}

export interface Relogio {
  agora: () => number;
  dormir: (ms: number) => Promise<void>;
}
export const relogioReal: Relogio = { agora: () => Date.now(), dormir: (ms) => new Promise((r) => setTimeout(r, ms)) };

/**
 * Corre o plano de tentativas com o orçamento. `tentar(url, tempoMs)` faz UM pedido e devolve o valor (sucesso) ou o
 * resultado da falha (com o Retry-After, se veio). Etapas: só códigos ("host:429", "overpass:esgotado") — nunca o ponto.
 */
export async function comRodizio<T>(
  plano: readonly { url: string; esperaAntesMs: number }[],
  tentar: (url: string, tempoMs: number) => Promise<{ ok: T } | { falha: ResultadoTentativa; retryAfterMs?: number | null }>,
  etapas: string[],
  orcamentoMs = ORCAMENTO_OVERPASS_MS,
  relogio: Relogio = relogioReal,
): Promise<T | null> {
  const inicio = relogio.agora();
  const descartados = new Set<string>();
  // O Retry-After vale para o servidor que o pediu (o outro servidor não espera por ele): "livre a partir de" por url.
  const livreEm = new Map<string, number>();
  let primeira = true;
  for (const passo of plano) {
    if (descartados.has(passo.url)) continue;
    const agora = relogio.agora();
    const restante = orcamentoMs - (agora - inicio);
    const pedida = livreEm.has(passo.url) ? Math.max(0, livreEm.get(passo.url)! - agora) : null;
    const espera = primeira ? 0 : esperaAntes(passo.esperaAntesMs, pedida, restante);
    if (espera === null) break;
    if (espera > 0) await relogio.dormir(espera);
    const tempo = tempoDaTentativa(orcamentoMs - (relogio.agora() - inicio));
    if (tempo === null) break;
    primeira = false;
    const r = await tentar(passo.url, tempo);
    if ("ok" in r) return r.ok;
    if (r.retryAfterMs != null) livreEm.set(passo.url, relogio.agora() + r.retryAfterMs);
    if (!repetivel(r.falha)) descartados.add(passo.url);
  }
  etapas.push("overpass:esgotado");
  return null;
}
