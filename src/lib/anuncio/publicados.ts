/*
  Regra ÚNICA de "imóvel publicado" (F31): status "active". A Visão geral e
  "Meus imóveis" usam esta regra sobre a MESMA consulta (listMyProperties).
*/
export function imovelPublicado(p: { status?: string | null }): boolean {
  return p.status === "active";
}

export function imoveisPublicados<T extends { status?: string | null }>(lista: T[]): T[] {
  return lista.filter(imovelPublicado);
}
