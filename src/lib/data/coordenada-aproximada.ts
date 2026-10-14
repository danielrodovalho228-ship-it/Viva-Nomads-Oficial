/*
  Coordenada aproximada para tudo que é PÚBLICO (pins da busca, home, cidades,
  página do anúncio): o ponto exato só é liberado após o aceite e vive no painel
  do dono. Duas camadas: deslocamento fixo por imóvel (até ~250 m, estável pelo
  id) e arredondamento a 3 casas (~110 m). Resultado: no máximo ~360 m do real.
*/
export const aproximarCoordenada = (n: number): number => Math.round(n * 1000) / 1000;

const DESLOCAMENTO_MAX = 0.00225; // ~250 m em graus

/** Hash estável (FNV-1a) → dois números em [-1, 1] para deslocar lat/lng. */
function deslocamentoDoId(id: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16; // mistura final
  const a = ((h & 0xffff) / 0xffff) * 2 - 1;
  const b = (((h >>> 16) & 0xffff) / 0xffff) * 2 - 1;
  return [a, b];
}

/** Devolve cópia do imóvel com lat/lng deslocados e arredondados (não muta a entrada). */
export function comCoordenadaAproximada<T extends { lat: number; lng: number; id?: string }>(p: T): T {
  const [da, db] = deslocamentoDoId(p.id ?? "");
  return {
    ...p,
    lat: aproximarCoordenada(p.lat + da * DESLOCAMENTO_MAX),
    lng: aproximarCoordenada(p.lng + db * DESLOCAMENTO_MAX),
  };
}
