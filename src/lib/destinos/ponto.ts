/*
  Destinos (prompt 37, correção do /admin/destinos) — PURO. Ponto do destino a partir da busca no mapa ou colado pelo
  admin. Nenhuma coordenada nasce aqui: só lemos o que o serviço de mapa devolve ou o que o admin colou.
*/

export interface PontoSugerido {
  id: string;
  /** Nome do lugar + endereço, como o serviço de mapa devolve. */
  rotulo: string;
  lat: number;
  lng: number;
}

/** Dentro do Brasil (os mesmos limites da tabela destinos e de validarDestino). */
export function pontoNoBrasil(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -34 && lat <= 6 && lng >= -75 && lng <= -28;
}

/**
 * "-18.9186, -48.2772" (o formato que o Google Maps copia) ou "-18,9186 -48,2772" → {lat, lng}. Qualquer outra coisa
 * → null (o campo fica como o admin digitou).
 */
export function pontoColado(texto: string): { lat: string; lng: string } | null {
  const t = texto.trim();
  // Ponto decimal: separados por vírgula e/ou espaço. Vírgula decimal: separados por espaço ou ponto e vírgula.
  const m = t.match(/^(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)$/) ?? t.match(/^(-?\d{1,2},\d+)\s*[;\s]\s*(-?\d{1,3},\d+)$/);
  if (!m) return null;
  const lat = m[1].replace(",", ".");
  const lng = m[2].replace(",", ".");
  return pontoNoBrasil(Number(lat), Number(lng)) ? { lat, lng } : null;
}

/** Texto da busca: o nome digitado + cidade e UF do formulário (sem repetir a cidade se já estiver no texto). */
export function consultaDoPonto(q: string, cidade: string, uf: string): string {
  const base = q.trim().replace(/\s+/g, " ").slice(0, 120);
  const c = cidade.trim();
  const temCidade = c && base.toLowerCase().includes(c.toLowerCase());
  return [base, temCidade ? "" : c, uf.trim().toUpperCase()].filter(Boolean).join(", ");
}

const seis = (n: number) => Math.round(n * 1e6) / 1e6;

/** Resposta do Google Places (Text Search) → sugestões dentro do Brasil (até 5). */
export function pontosDoGoogle(j: unknown): PontoSugerido[] {
  const r = (j as { status?: string; results?: unknown[] } | null) ?? {};
  if (r.status !== "OK" || !Array.isArray(r.results)) return [];
  const out: PontoSugerido[] = [];
  for (const x of r.results as { place_id?: string; name?: string; formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }[]) {
    const lat = Number(x.geometry?.location?.lat);
    const lng = Number(x.geometry?.location?.lng);
    if (!x.place_id || !pontoNoBrasil(lat, lng)) continue;
    out.push({ id: `g:${x.place_id}`, rotulo: [x.name, x.formatted_address].filter(Boolean).join(" — "), lat: seis(lat), lng: seis(lng) });
    if (out.length === 5) break;
  }
  return out;
}

/** Resposta do Nominatim (OpenStreetMap, format=jsonv2) → sugestões dentro do Brasil (até 5). */
export function pontosDoOsm(j: unknown): PontoSugerido[] {
  if (!Array.isArray(j)) return [];
  const out: PontoSugerido[] = [];
  for (const x of j as { place_id?: number | string; display_name?: string; lat?: string; lon?: string }[]) {
    const lat = Number(x.lat);
    const lng = Number(x.lon);
    if (x.place_id == null || !x.display_name || !pontoNoBrasil(lat, lng)) continue;
    out.push({ id: `osm:${x.place_id}`, rotulo: x.display_name, lat: seis(lat), lng: seis(lng) });
    if (out.length === 5) break;
  }
  return out;
}
