/**
 * Fotos do painel logado. Prompt 42, item 2: as capas de título (faixa de foto no topo de cada tela) saíram — o título
 * das telas logadas é só texto (PageTitle). Ficam as fotos dos grupos da página "Ferramentas" (uma por grupo, únicas —
 * o guarda src/lib/imagens-unicas.test.ts falha se a mesma foto aparecer em dois lugares).
 */
const DIR = "/images/painel";

/** Fotos dos grupos da página "Ferramentas" (uma por grupo, também únicas). */
export const FOTOS_FERRAMENTAS = {
  analise: { src: `${DIR}/ferramentas-analise.webp`, alt: "Lápis sobre um gráfico de barras impresso" },
  fechamento: { src: `${DIR}/ferramentas-fechamento.webp`, alt: "Entrega das chaves do apartamento de mão em mão" },
  protecao: { src: `${DIR}/ferramentas-protecao.webp`, alt: "Detector de fumaça no teto e extintor no corredor do apartamento" },
} as const;
