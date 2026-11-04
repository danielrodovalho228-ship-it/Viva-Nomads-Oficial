/*
  E489 — "Ver todas" do sino (/dashboard/notificacoes#avisos) leva à LISTA de avisos, não às preferências. PURO.
*/
export const ANCORA_AVISOS = "avisos";

/** A URL chegou com a âncora da lista de avisos? */
export function deveIrParaAvisos(hash: string | null | undefined): boolean {
  return (hash ?? "") === `#${ANCORA_AVISOS}`;
}
