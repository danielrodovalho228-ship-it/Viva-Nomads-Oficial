/*
  Editor de anúncio — quais etapas do topo podem ser clicadas (bug 13 da L2).
  Voltar e pular para etapas JÁ VISITADAS é livre; avançar para uma etapa nova
  só pelo "Continuar" (que valida). A etapa mais avançada fica no rascunho,
  para a retomada não travar o que a pessoa já tinha percorrido. PURO.
*/

export function etapaMaisAvancada(anterior: number, ...atuais: number[]): number {
  return Math.max(anterior, ...atuais.filter((n) => Number.isFinite(n)));
}

export function etapaLiberada(i: number, atual: number, maisAvancada: number): boolean {
  return i <= Math.max(atual, maisAvancada);
}

/** Lê a etapa mais avançada de um rascunho salvo (antigos não têm: vale a etapa atual). */
export function etapaMaxDoRascunho(d: { step?: unknown; etapaMax?: unknown }, ultima: number): number {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(ultima, Math.max(0, Math.round(v))) : 0);
  return Math.max(n(d.step), n(d.etapaMax));
}
