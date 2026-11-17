/*
  Os cartões "Tipos de parceria" de /parceiros — regras PURAS dos caminhos de cada cartão.
  E896: o cartão "Gestores e administradoras" nunca fica sem saída. Com a página de preços visível, "Ver o Plano Gestor"
  (/precos#plano-gestor, E302); com ela suspensa (E563), a escada de taxas com o Plano Gestor em /para-proprietarios#taxa.
*/
export interface LinkCartao {
  href: string;
  rotulo: string;
}

/** E910: a ligação de parceria do cartão, como nos cartões irmãos ("Sou fotógrafo", "Pedir parceria"). */
export const LINK_PARCERIA_GESTORES: LinkCartao = { href: "/parceiros?categoria=outro#quero-ser-parceiro", rotulo: "Pedir parceria" };

export function linksDoCartaoGestores(precosVisivel: boolean): LinkCartao[] {
  const taxas: LinkCartao[] = precosVisivel
    ? [{ href: "/precos#plano-gestor", rotulo: "Ver o Plano Gestor" }]
    : [{ href: "/para-proprietarios#taxa", rotulo: "Taxas e Plano Gestor" }];
  return [...taxas, LINK_PARCERIA_GESTORES];
}
