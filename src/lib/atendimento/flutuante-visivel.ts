/**
 * Botão flutuante "Fale com a Viva" (F49 + ordem 4f8d17c6): o mesmo formato e
 * sempre visível em todas as páginas. Em vez de SUMIR quando um botão principal
 * ou campo passa por baixo dele, ele SOBE só o necessário para não tampar e
 * volta ao lugar depois. Some apenas enquanto a pessoa digita num campo (o
 * teclado do celular sobe) e volta ao sair do campo; com o chat aberto, nunca.
 */

export type Caixa = { left: number; top: number; right: number; bottom: number };

/** Folga mínima entre o botão flutuante e um controle da página. */
export const FOLGA_PX = 8;

const temTamanho = (r: Caixa) => r.right > r.left && r.bottom > r.top;

/**
 * Quantos px o botão precisa subir (a partir da posição de repouso `botao`) para
 * não tampar nenhum dos `controles`. Sobe em degraus até ficar livre (um controle
 * acima do outro), limitado a `limite` px.
 */
export function elevacaoDoFlutuante(botao: Caixa, controles: Caixa[], limite: number): number {
  if (!temTamanho(botao)) return 0;
  const alvos = controles.filter(temTamanho);
  let sobe = 0;
  for (let i = 0; i < 12; i++) {
    const topo = botao.top - sobe - FOLGA_PX;
    const baixo = botao.bottom - sobe + FOLGA_PX;
    const batem = alvos.filter((r) => r.left < botao.right + FOLGA_PX && r.right > botao.left - FOLGA_PX && r.top < baixo && r.bottom > topo);
    if (batem.length === 0) break;
    sobe = Math.max(sobe, ...batem.map((r) => botao.bottom - r.top + FOLGA_PX));
    if (sobe >= limite) return limite;
  }
  return Math.round(sobe);
}

const TIPOS_SEM_TECLADO = new Set(["button", "submit", "reset", "checkbox", "radio", "range", "file", "image", "color"]);

/** O elemento em foco é um campo onde a pessoa digita/escolhe (abre teclado ou lista)? */
export function ehCampoDeFormulario(tag: string | undefined, tipo?: string | null): boolean {
  const t = (tag ?? "").toLowerCase();
  if (t === "textarea" || t === "select") return true;
  if (t === "input") return !TIPOS_SEM_TECLADO.has((tipo ?? "text").toLowerCase());
  return false;
}

export function flutuanteVisivel(estado: { chatAberto: boolean; campoEmFoco: boolean }): boolean {
  return estado.chatAberto || !estado.campoEmFoco;
}
