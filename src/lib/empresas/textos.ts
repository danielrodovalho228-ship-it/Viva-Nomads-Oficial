/*
  E947 — fonte única das frases de Moradia para empresas: a página /empresas e a Central de Ajuda importam daqui (nada
  escrito à mão em dois lugares). O prazo de resposta do "Fale com a gente" vem de config/prazos-canais (TEXTO_PRAZO_EMPRESAS).
*/
/** A taxa: é do proprietário, por contrato fechado; quem vem morar não paga taxa à plataforma. */
export const TAXA_EMPRESAS = "A taxa da Viva é do proprietário, por contrato fechado; quem vem morar não paga taxa à plataforma, e não há mensalidade.";
/** O recibo da estadia: emitido pelo proprietário, todo mês. */
export const RECIBO_EMPRESAS = "O proprietário emite o recibo mensal da estadia em nome dele. A Viva Nomads não emite nota para a empresa e não cobra nada de quem vem morar.";
/** O id da pergunta da Ajuda (para remissões e para o link direto ?pergunta=). */
export const ID_PERGUNTA_EMPRESAS = "empresa-moradia";
export const PERGUNTA_EMPRESAS = "Minha empresa pode alugar moradia para funcionários?";
/** O link direto para a pergunta na Central de Ajuda (tema "Para quem procura moradia"). */
export const HREF_PERGUNTA_EMPRESAS = `/ajuda/morador?pergunta=${ID_PERGUNTA_EMPRESAS}`;
