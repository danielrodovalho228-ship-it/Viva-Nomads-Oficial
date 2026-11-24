/*
  Os cartões "Tipos de parceria" de /parceiros — regras PURAS dos caminhos de cada cartão.
  E896: o cartão "Gestores e administradoras" nunca fica sem saída. Prompt 078 (16/11/2026): sem o Plano Gestor, o cartão
  leva às taxas — com a página de preços visível, a seção das carteiras (/precos#carteiras); com ela suspensa (E563), a
  escada de taxas com a linha das carteiras em /para-proprietarios#taxa.
*/
export interface LinkCartao {
  href: string;
  rotulo: string;
}

export const ROTULO_VER_TAXAS = "Ver as taxas";

export function linksDoCartaoGestores(precosVisivel: boolean): LinkCartao[] {
  return [{ href: precosVisivel ? "/precos#carteiras" : "/para-proprietarios#taxa", rotulo: ROTULO_VER_TAXAS }];
}
