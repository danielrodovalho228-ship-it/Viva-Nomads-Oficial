/*
  O RÓTULO do anúncio de exemplo, sozinho. Fica separado dos proprietários e das avaliações fictícias
  (./exemplo-proprietarios.ts) para que uma tela que só precisa do rótulo — como a linha de "Meus imóveis", no painel —
  não leve os dados fictícios junto no JavaScript (E744, varredura dos dados de exemplo no painel).
*/

/**
 * E926: UM nome só para o anúncio de exemplo, em todas as superfícies: "Anúncio de exemplo" (o dos cartões). Antes o selo da
 * página do imóvel, do bloco do proprietário, das avaliações e do perfil de exemplo usava outro nome, e o aviso abaixo, um
 * terceiro. Os nomes antigos estão no teste que os proíbe (src/lib/e926-termo-unico-exemplo.test.ts).
 */
export const SELO_EXEMPLO = "Anúncio de exemplo";
export const AVISO_EXEMPLO = "Anúncio de exemplo: nos anúncios reais estes dados vêm do perfil e das estadias verificadas.";
