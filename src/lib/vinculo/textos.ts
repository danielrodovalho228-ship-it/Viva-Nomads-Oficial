/**
 * Textos do vínculo profissional (ordem 9950ef15, item 2). PURO: o servidor e a tela importam daqui
 * (um arquivo "use server" só pode exportar funções assíncronas, por isso as frases não ficam em actions.ts).
 */
export const SELO_VINCULO = "Vínculo profissional confirmado";
export const MSG_DOMINIO_RECUSADO = "Use o e-mail da sua empresa, hospital ou universidade. E-mails como Gmail e Hotmail não servem para este selo.";
export const MSG_MUITOS_PEDIDOS = "Você pediu códigos demais. Aguarde uma hora e tente de novo.";
export const TEXTO_O_QUE_E_VINCULO = "Confirme por e-mail da sua empresa, hospital ou universidade. Só o nome do domínio aparece no selo; o e-mail não é guardado.";
export const TEXTO_OPCIONAL_VINCULO = "Opcional";

/** Detalhe do selo: só o nome do domínio, nada mais. */
export function detalheVinculo(dominio: string): string {
  return `${SELO_VINCULO} · ${dominio}`;
}
