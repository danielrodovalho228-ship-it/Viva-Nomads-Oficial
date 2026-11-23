/*
  E832: os botões reais do cartão final do vídeo institucional (PURO, sem React: o teste lê daqui). O player e os
  demais dados (arquivos, duração) estão em video-institucional.tsx.
*/
/** E832: o cartão final (logo, botões, URL) entra com a última fala da legenda, aos 25,6 s. */
export const INICIO_DO_CARTAO_FINAL = 25.6;

export interface BotaoDoFim {
  rotulo: string;
  href: string;
  /** Posição em % da caixa 16:9, medida no quadro final de institucional.mp4 (1280×720). */
  caixa: { esquerda: number; topo: number; largura: number; altura: number };
  cor: "azul" | "verde";
}

/**
 * E832: os botões do cartão final fazem parte da IMAGEM do vídeo. Estes links reais ficam exatamente por cima deles
 * (botões pintados em y 347–420 e x 250–624 / 656–1030 do quadro 1280×720), com 1 % de folga em volta.
 */
export const BOTOES_DO_FIM: readonly BotaoDoFim[] = [
  { rotulo: "Encontrar meu lar", href: "/buscar", caixa: { esquerda: 18.5, topo: 47, largura: 31, altura: 12.5 }, cor: "azul" },
  // Visitante sem sessão cai no login de anunciar (o proxy põe motivo=anunciar), como o E807/E833.
  { rotulo: "Anunciar grátis", href: "/dashboard/imoveis/novo", caixa: { esquerda: 50.5, topo: 47, largura: 31, altura: 12.5 }, cor: "verde" },
];
