/*
  Os cartões "Tipos de parceria" de /parceiros — regras PURAS dos caminhos de cada cartão.
  E896: o cartão "Gestores e administradoras" nunca fica sem saída. Com a página de preços visível, "Ver o Plano Gestor"
  (/precos#plano-gestor, E302); com ela suspensa (E563), a escada de taxas com o Plano Gestor em /para-proprietarios#taxa.
*/
export interface LinkCartao {
  href: string;
  rotulo: string;
}

export function linksDoCartaoGestores(precosVisivel: boolean): LinkCartao[] {
  return precosVisivel
    ? [{ href: "/precos#plano-gestor", rotulo: "Ver o Plano Gestor" }]
    : [{ href: "/para-proprietarios#taxa", rotulo: "Taxas e Plano Gestor" }];
}
