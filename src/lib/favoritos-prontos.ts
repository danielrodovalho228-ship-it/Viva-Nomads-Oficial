/**
 * E535: a lista de favoritos já pode ser contada? Só com os imóveis carregados, a sessão conferida e — logado — a lista
 * da conta já trazida nesta aba (mesclarGuardadosDoConvidado). Antes disso, qualquer número seria um "0" falso.
 */
export function favoritosProntos(e: { loading: boolean; authChecked: boolean; userId: string | null; sincronizado: string | null }): boolean {
  if (e.loading || !e.authChecked) return false;
  return e.userId === null || e.sincronizado === e.userId;
}
