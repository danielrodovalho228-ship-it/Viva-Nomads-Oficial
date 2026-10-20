/*
  Destino da busca na URL (Prompt 37) — PURO.
    destino cadastrado: ?destino=hc-ufu&modo=carro&ate=20
    endereço digitado:  ?dlat=-18.92&dlng=-48.26&drot=Av.%20Pará%2C%20Umuarama&modo=a_pe&ate=15
  A URL nunca leva mais de 2 casas decimais (~1 km) nem número de casa: o rótulo é limpo antes de ir para a URL, para
  o banco ou para qualquer tela.
*/
import { ehModo, OPCOES_ATE, type Modo } from "./tempo.ts";

export interface DestinoDaBusca {
  /** Destino cadastrado (slug). */
  slug?: string;
  /** Endereço digitado: ponto arredondado a 2 casas + rótulo limpo. */
  ponto?: { lat: number; lng: number; rotulo: string };
  modo: Modo;
  /** Filtro "até N min" (0 = sem filtro). */
  ate: number;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const casas = (n: number, d: number): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/** Ponto plausível no Brasil continental (descarta 0,0 e lixo). */
export function pontoValido(lat: unknown, lng: unknown): boolean {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === 0 && b === 0) return false;
  return a >= -34 && a <= 6 && b >= -74 && b <= -33;
}

/**
 * Rótulo limpo: sem número de casa, sem CEP, sem complemento ("apto 12", "bloco B"), sem ", Brasil".
 * "Rua Tal, 123 - Umuarama, Uberlândia - MG, 38400-000, Brasil" → "Rua Tal - Umuarama, Uberlândia - MG".
 */
export function limparRotulo(texto: string | null | undefined): string {
  let t = String(texto ?? "").normalize("NFC");
  t = t.replace(/\b\d{5}-?\d{3}\b/g, " "); // CEP
  t = t.replace(/(^|[\s,])(apto|apartamento|ap|bloco|bl|torre|casa|sala|lote|lt|quadra|qd)\.?\s+[\wÀ-ú-]+/gi, "$1 "); // complemento
  t = t.replace(/(^|[\s,])(n[º°o]?\.?|número|numero|km)\s*\d[\w-]*/gi, "$1 ");
  t = t.replace(/\b\d+[a-z]?\b/gi, " "); // números soltos (número da casa)
  t = t.replace(/,?\s*Brasil\s*$/i, "");
  t = t.replace(/\s+([,.-])/g, "$1").replace(/([,-])(?=\S)/g, "$1 ");
  t = t.replace(/(\s*,\s*)+/g, ", ").replace(/(\s*-\s*)+/g, " - ");
  t = t.replace(/\s*,\s*-\s*/g, " - ").replace(/\s*-\s*,\s*/g, ", ");
  t = t.replace(/^[\s,.-]+|[\s,.-]+$/g, "").replace(/\s+/g, " ");
  return t.slice(0, 80).trim();
}

/** Lê o destino da URL. null quando não há destino válido. */
export function destinoDaUrl(qs: string | URLSearchParams): DestinoDaBusca | null {
  const sp = typeof qs === "string" ? new URLSearchParams(qs.startsWith("?") ? qs.slice(1) : qs) : qs;
  const modoQ = sp.get("modo");
  const modo: Modo = ehModo(modoQ) ? modoQ : "carro";
  const ateQ = Number(sp.get("ate"));
  const ate = (OPCOES_ATE as readonly number[]).includes(ateQ) ? ateQ : 0;
  const slug = (sp.get("destino") ?? "").trim().toLowerCase();
  if (slug && slug.length <= 60 && SLUG.test(slug)) return { slug, modo, ate };
  const lat = sp.get("dlat");
  const lng = sp.get("dlng");
  if (lat && lng && pontoValido(lat, lng)) {
    return {
      ponto: { lat: casas(Number(lat), 2), lng: casas(Number(lng), 2), rotulo: limparRotulo(sp.get("drot")) || "o endereço informado" },
      modo,
      ate,
    };
  }
  return null;
}

/** Grava o destino nos parâmetros (apaga os do outro tipo). Duas casas decimais, rótulo limpo. */
export function destinoNaUrl(params: URLSearchParams, d: DestinoDaBusca | null): URLSearchParams {
  for (const k of ["destino", "dlat", "dlng", "drot", "modo", "ate"]) params.delete(k);
  if (!d) return params;
  if (d.slug) params.set("destino", d.slug);
  else if (d.ponto) {
    params.set("dlat", casas(d.ponto.lat, 2).toFixed(2));
    params.set("dlng", casas(d.ponto.lng, 2).toFixed(2));
    const r = limparRotulo(d.ponto.rotulo);
    if (r) params.set("drot", r);
  } else return params;
  if (d.modo !== "carro") params.set("modo", d.modo);
  if (d.ate) params.set("ate", String(d.ate));
  return params;
}

/** Chave do cache para um endereço digitado: o ponto arredondado a 3 casas. */
export function chavePonto(lat: number, lng: number): string {
  return `p:${casas(lat, 3).toFixed(3)},${casas(lng, 3).toFixed(3)}`;
}

/** Chave do cache para um destino cadastrado. */
export const chaveDestino = (id: string): string => `d:${id}`;
