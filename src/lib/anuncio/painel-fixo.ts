/**
 * E528 (D14, QA de cliques do morador 02/11): o painel de preço do anúncio ficava preso no topo com ALTURA MÁXIMA e
 * rolagem própria — ao rolar, o cabeçalho/total cortava no topo e os campos de baixo ("Motivo da estadia") no rodapé da
 * janela; era preciso rolar DENTRO do painel. Agora o painel não tem rolagem interna:
 *  - se cabe na janela, fica preso no topo de sempre (9 rem = 144 px, abaixo do topo e das abas da página);
 *  - se é mais alto, rola junto com a página até a BASE aparecer e prende pela base (top negativo) — tudo dele se lê só
 *    rolando a página.
 */
export const TOPO_PAINEL_PRECO = 144;
const FOLGA_BASE = 16;

export function topoDoPainel(alturaPainel: number, alturaJanela: number, topo = TOPO_PAINEL_PRECO): number {
  if (alturaPainel + topo + FOLGA_BASE <= alturaJanela) return topo;
  return alturaJanela - alturaPainel - FOLGA_BASE;
}
