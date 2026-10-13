/**
 * Quando o botão flutuante "Fale com a Viva" deve sair da frente no celular (F49):
 * enquanto um campo de formulário está em foco ou quando um botão principal (CTA)
 * está na faixa de baixo da tela. Com o chat aberto ele nunca some.
 */
export const FAIXA_CTA_PX = 140;

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
