/*
  E489 — "Ver todas" do sino (/dashboard/notificacoes#avisos) leva à LISTA de avisos, não às preferências. PURO.
  E496 — no build de produção, depois de abrir a página com #avisos uma vez, o "Ver todas" chega com a âncora repetida
  (/dashboard/notificacoes#avisos#avisos): a lista não era levada à vista e o endereço ficava num estado errado.
*/
export const ANCORA_AVISOS = "avisos";

/** As partes da âncora ("#a#b" → ["a", "b"]). */
const partes = (hash: string | null | undefined) => (hash ?? "").split("#").filter(Boolean);

/** A URL chegou com a âncora da lista de avisos (uma vez ou repetida)? */
export function deveIrParaAvisos(hash: string | null | undefined): boolean {
  const p = partes(hash);
  return p.length > 0 && p.every((x) => x === ANCORA_AVISOS);
}

/** E496: a âncora repetida ("#avisos#avisos") volta à forma única; qualquer outro caso não pede correção (null). */
export function hashAvisosNormalizado(hash: string | null | undefined): string | null {
  return deveIrParaAvisos(hash) && partes(hash).length > 1 ? `#${ANCORA_AVISOS}` : null;
}
