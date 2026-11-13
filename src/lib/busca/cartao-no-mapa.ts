/**
 * E524 (D10, QA de cliques do morador, 02/11): o cartão que abre no pin do mapa da busca precisa caber DENTRO do mapa,
 * longe dos botões de zoom (canto superior direito), com o "Fechar" sempre clicável — e Esc fecha.
 *
 * Folgas em px a partir das bordas do mapa. A da direita livra a coluna do zoom: 10 px de margem do controle + o botão
 * (34 px no computador; 48 px em tela de toque, pela área de toque de 44 px da casa) + 14 px de respiro. Sem ela o
 * cartão do pin da borda (R$ 4.100, Tibery) ficava por baixo do zoom e o "Fechar" não recebia o clique. No celular o
 * mapa tem 350 px: 16 + 256 (cartão) + 72 = 344 — cabe.
 */
export const FOLGA_CARTAO_MAPA = { topo: 16, esquerda: 16, base: 16, direita: 72 } as const;

export type Caixa = { left: number; top: number; right: number; bottom: number };

/**
 * Quanto o CARTÃO precisa andar (dx, dy em px) para caber no mapa com as folgas. Quando o mapa é menor que o cartão,
 * vencem o topo e a esquerda — é onde fica o "Fechar". Quem move o mapa usa o inverso (panBy([-dx, -dy])).
 */
export function deslocamentoParaCaber(card: Caixa, mapa: Caixa, folga: typeof FOLGA_CARTAO_MAPA = FOLGA_CARTAO_MAPA): { dx: number; dy: number } {
  const eixo = (ini: number, fim: number, min: number, max: number) => {
    if (ini < min) return min - ini;
    if (fim > max) return Math.max(max - fim, min - ini);
    return 0;
  };
  return {
    dx: eixo(card.left, card.right, mapa.left + folga.esquerda, mapa.right - folga.direita),
    dy: eixo(card.top, card.bottom, mapa.top + folga.topo, mapa.bottom - folga.base),
  };
}

/**
 * Quanto a PÁGINA rola (px; negativo sobe) para o cartão aparecer entre as barras fixas — o topo do site (sticky) e a
 * barra de abas do celular. Se não couber inteiro, vence o topo do cartão (onde fica o "Fechar").
 */
export function rolagemParaMostrar(card: { top: number; bottom: number }, livreTopo: number, livreBase: number, respiro = 8): number {
  const min = livreTopo + respiro;
  const max = livreBase - respiro;
  if (card.top < min) return card.top - min;
  if (card.bottom > max) return Math.min(card.bottom - max, card.top - min);
  return 0;
}

/**
 * No celular o mapa é mais alto que a tela e a página rola: o cartão pode caber no mapa e mesmo assim ficar fora da
 * parte visível — ou por baixo do topo fixo do site, que tampava o "Fechar". Depois do enquadramento, a página rola o
 * mínimo para o cartão aparecer entre as barras fixas.
 */
/** As barras presas que o cartão do mapa não pode ficar por baixo: o topo do site, a barra de abas do celular e quem se
 *  marca `data-barra-fixa` (Frente 3: a faixa de filtros presa da busca no celular, E780, é uma div). */
export const SELETOR_BARRAS_FIXAS = "header, nav, [data-barra-fixa]";

export function mostrarCartaoNaTela(el: HTMLElement | null) {
  setTimeout(() => {
    if (!el) return;
    const barras = [...document.querySelectorAll<HTMLElement>(SELETOR_BARRAS_FIXAS)].filter((b) => {
      const pos = getComputedStyle(b).position;
      return (pos === "sticky" || pos === "fixed") && b.getBoundingClientRect().height > 0;
    });
    const meio = innerHeight / 2;
    const livreTopo = Math.max(0, ...barras.map((b) => b.getBoundingClientRect()).filter((r) => r.top < meio).map((r) => r.bottom));
    const livreBase = Math.min(innerHeight, ...barras.map((b) => b.getBoundingClientRect()).filter((r) => r.top >= meio).map((r) => r.top));
    const dy = rolagemParaMostrar(el.getBoundingClientRect(), livreTopo, livreBase);
    if (dy) window.scrollBy({ top: dy, behavior: "smooth" });
  }, 300);
}

/** Esc fecha o cartão do mapa (D10: só clicando no cartão dava para sair). */
export const fechaCartaoComTecla = (tecla: string) => tecla === "Escape";
