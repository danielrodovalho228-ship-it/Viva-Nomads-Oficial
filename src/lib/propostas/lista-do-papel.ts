/**
 * E536: a lista de propostas de quem está vendo. O morador tem a dele em /dashboard/propostas ("Propostas" no menu do
 * morador); o proprietário, em Orçamentos. Levar o morador a Orçamentos trocava o painel para o modo proprietário.
 */
export function listaDePropostasDoPapel(papel: "owner" | "tenant"): { href: string; rotulo: string } {
  return papel === "tenant"
    ? { href: "/dashboard/propostas", rotulo: "Ver todas as propostas" }
    : { href: "/dashboard/orcamentos", rotulo: "Ver todos os orçamentos" };
}
