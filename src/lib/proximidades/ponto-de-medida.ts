/*
  E389: "UFU — Campus Santa Mônica" aparecia "a 400 m" e minutos depois "a 600 m" para o MESMO endereço. A distância das âncoras
  era medida do ponto PÚBLICO do anúncio (arredondado em 3 casas, ~100 m de erro), enquanto o lugar adicionado à mão e o "Tempo
  até" usavam o ponto EXATO. Regra única: o dono vê sempre a distância medida do ponto EXATO do próprio anúncio (nunca vai à
  resposta); sem ele, o público. PURO (node --test).
*/
export interface PontoGeo {
  lat: number;
  lng: number;
}

const valido = (p: { lat: number | null | undefined; lng: number | null | undefined }): p is PontoGeo =>
  p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) && (Number(p.lat) !== 0 || Number(p.lng) !== 0);

export function escolherPontoDeMedida(
  exato: { lat: number | null | undefined; lng: number | null | undefined },
  publico: { lat: number | null | undefined; lng: number | null | undefined },
): PontoGeo | null {
  if (valido(exato)) return { lat: Number(exato.lat), lng: Number(exato.lng) };
  if (valido(publico)) return { lat: Number(publico.lat), lng: Number(publico.lng) };
  return null;
}
