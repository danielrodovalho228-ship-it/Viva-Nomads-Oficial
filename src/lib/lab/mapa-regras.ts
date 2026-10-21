/**
 * Regras puras do mapa anônimo da /buscar (ordem c4323fd9, antiga smoke-mapa-anonimo).
 * O spec t258 coleta os tiles que o navegador pediu e usa estas funções para julgar.
 */

/** Todo tile sem chave devolve sempre o mesmo PNG carimbado "API KEY REQUIRED". */
export const TAMANHO_TILE_CARIMBADO = 2049;

export type TileVisto = { url: string; bytes: number };

export function ehTileCarto(url: string): boolean {
  return /cartocdn\.com/.test(url);
}

export function tileTemChave(url: string): boolean {
  return /[?&]key=/.test(url);
}

/** Lista o que está errado; vazio = mapa anônimo limpo. */
export function problemasDoMapaAnonimo(tiles: TileVisto[]): string[] {
  const carto = tiles.filter((t) => ehTileCarto(t.url));
  if (carto.length === 0) return ["nenhum tile da CARTO foi pedido"];
  const problemas: string[] = [];
  const semChave = carto.filter((t) => !tileTemChave(t.url)).length;
  const carimbados = carto.filter((t) => t.bytes === TAMANHO_TILE_CARIMBADO).length;
  if (semChave > 0) problemas.push(`${semChave} tile(s) sem ?key=`);
  if (carimbados > 0) problemas.push(`${carimbados} tile(s) carimbado(s) de ${TAMANHO_TILE_CARIMBADO} bytes`);
  return problemas;
}
