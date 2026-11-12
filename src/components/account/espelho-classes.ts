/*
  E800 (D3, prova de 12/11): a pílula "É assim que o morador/proprietário te vê…" quebrava em duas linhas com o texto
  encostando nas bordas (rounded-full + px-3), e o relógio cobria o começo de "Responde X% das conversas…" (o ícone
  encolhia no flex quando o texto quebrava). Classes únicas das duas prévias (dono e morador).
*/
/** A pílula-título: com folga lateral e raio que acompanha a quebra (12 px), o ícone no topo da 1ª linha. */
export const PILULA_TITULO_ESPELHO =
  "inline-flex max-w-full items-start gap-2 rounded-xl bg-forest px-4 py-2 text-left text-sm font-semibold leading-5 text-white xl:text-xs";
/** Caixa do ícone: a altura de UMA linha (h-5 = leading-5) — o ícone fica centrado na 1ª linha e nunca encolhe. */
export const CAIXA_ICONE_ESPELHO = "flex h-5 shrink-0 items-center";
export const ICONE_PILULA_ESPELHO = "h-4 w-4 shrink-0";
/** A linha "Responde X% das conversas, …": o relógio não encolhe nem cobre o texto quando ele quebra. */
export const LINHA_RESPOSTA_ESPELHO = "mt-1 flex items-start gap-1 text-sm leading-5 text-muted lg:justify-center";
export const ICONE_RESPOSTA_ESPELHO = "h-4 w-4 shrink-0";
