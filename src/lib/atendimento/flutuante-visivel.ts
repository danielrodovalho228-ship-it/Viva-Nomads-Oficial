/**
 * Quando o botão flutuante "Fale com a Viva" deve sair da frente no celular (F49):
 * enquanto um campo de formulário está em foco ou quando um botão principal (CTA)
 * cruza a área dele no canto da tela. Com o chat aberto ele nunca some.
 */

/** Quadrado do botão redondo no celular: 48 px, a 16 px da direita e 24 px de baixo (+ folga de 8 px). */
const LADO_BOTAO_PX = 48;
const FOLGA_PX = 8;

type Caixa = { left: number; top: number; right: number; bottom: number };

/**
 * O controle (botão principal/submit) cruza a área do botão flutuante, que fica fixa no canto
 * inferior direito da janela? Só então ele precisa sair da frente; CTA em outro ponto da faixa
 * de baixo não atrapalha (t59: a home carrega com o botão visível).
 */
export function cruzaCantoDoFlutuante(r: Caixa, larguraJanela: number, alturaJanela: number): boolean {
  if (r.right <= r.left || r.bottom <= r.top) return false;
  const direita = larguraJanela - 16 + FOLGA_PX;
  const baixo = alturaJanela - 24 + FOLGA_PX;
  const esquerda = direita - LADO_BOTAO_PX - 2 * FOLGA_PX;
  const topo = baixo - LADO_BOTAO_PX - 2 * FOLGA_PX;
  return r.left < direita && r.right > esquerda && r.top < baixo && r.bottom > topo;
}

const TIPOS_SEM_TECLADO = new Set(["button", "submit", "reset", "checkbox", "radio", "range", "file", "image", "color"]);

/** O elemento em foco é um campo onde a pessoa digita/escolhe (abre teclado ou lista)? */
export function ehCampoDeFormulario(tag: string | undefined, tipo?: string | null): boolean {
  const t = (tag ?? "").toLowerCase();
  if (t === "textarea" || t === "select") return true;
  if (t === "input") return !TIPOS_SEM_TECLADO.has((tipo ?? "text").toLowerCase());
  return false;
}

export function flutuanteVisivel(estado: { chatAberto: boolean; campoEmFoco: boolean; ctaNaFaixa: boolean }): boolean {
  return estado.chatAberto || !(estado.campoEmFoco || estado.ctaNaFaixa);
}
