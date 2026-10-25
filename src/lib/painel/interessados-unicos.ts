/*
  PROP-3 (E118): uma pessoa por imóvel em Interessados. A tabela leads não tem unicidade por (inquilino, imóvel) e a
  mesma pessoa podia aparecer duas vezes (candidatura nova depois de uma encerrada). Fica a mais recente — a lista já
  vem em ordem de criação decrescente. PURO, node --test.
*/
export function umPorPessoaEImovel<T extends { tenant_id: string; property_id: string }>(linhas: readonly T[]): T[] {
  const vistos = new Set<string>();
  const out: T[] = [];
  for (const l of linhas) {
    const chave = `${l.tenant_id}:${l.property_id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(l);
  }
  return out;
}
