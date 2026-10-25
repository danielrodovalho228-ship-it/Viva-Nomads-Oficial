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

/*
  E174-B — o selo nos contextos de confiança (perfil público, candidatura, mensagens, avaliações): "Vínculo profissional ·
  <domínio>". Só o domínio confirmado, nunca o e-mail. Nas listas de selos (strings), sai pelo componente único.
*/
export const PREFIXO_SELO_VINCULO = "Vínculo profissional · ";
const DOMINIO_VALIDO = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/** O texto do selo, ou null quando o domínio não tem a forma de um domínio (nunca um e-mail). */
export function seloVinculoPublico(dominio: string | null | undefined): string | null {
  const d = (dominio ?? "").trim().toLowerCase();
  return DOMINIO_VALIDO.test(d) ? `${PREFIXO_SELO_VINCULO}${d}` : null;
}

export const ehSeloVinculo = (s: string) => s.startsWith(PREFIXO_SELO_VINCULO);
export const dominioDoSelo = (s: string) => (ehSeloVinculo(s) ? s.slice(PREFIXO_SELO_VINCULO.length) : null);
