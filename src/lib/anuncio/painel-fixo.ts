/**
 * E528 (D14, QA de cliques do morador 02/11; 3ª reprova de 06/11): o painel de preço do anúncio fica preso ao rolar SÓ quando
 * cabe inteiro na janela (9 rem = 144 px do topo, abaixo do topo e das abas da página). Antes, quando era mais alto que a
 * janela, ele prendia pela BASE (top negativo): o cabeçalho e o total saíam cortados no topo e, no fim da página, o painel
 * sumia acima de "Imóveis parecidos" — quem preenchia não via o total (o painel mede ~1.400 px com o formulário aberto, bem
 * mais que qualquer janela). Agora, se não cabe, ele NÃO prende: rola com a página, inteiro e legível, e o total aparece de
 * novo ao lado do botão de ação (price-card).
 */
export const TOPO_PAINEL_PRECO = 144;
const FOLGA_BASE = 16;

/** O painel cabe inteiro, preso no topo, na janela? */
export function painelCabe(alturaPainel: number, alturaJanela: number, topo = TOPO_PAINEL_PRECO): boolean {
  return alturaPainel + topo + FOLGA_BASE <= alturaJanela;
}

/** O "top" do sticky quando cabe; null quando não cabe (o painel não prende). */
export function topoDoPainel(alturaPainel: number, alturaJanela: number, topo = TOPO_PAINEL_PRECO): number | null {
  return painelCabe(alturaPainel, alturaJanela, topo) ? topo : null;
}
