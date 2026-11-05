/**
 * E563 (decisão do Daniel, 04/11/2026): a página de preços está SUSPENSA enquanto NEXT_PUBLIC_PRECOS_VISIVEL não for "1"
 * (a mesma chave de src/config/precos-visivel.ts e do next.config). Com ela desligada, /precos e /planos vão para a home
 * e as portas somem; os testes da página pulam e as listas de rotas deixam /precos de fora. Ao religar a página, ligar
 * a variável também no ambiente dos testes: tudo volta a rodar como no E555.
 */
export const PRECOS_SUSPENSA = process.env.NEXT_PUBLIC_PRECOS_VISIVEL !== "1";

export const MOTIVO_PRECOS_SUSPENSA = "E563: página de preços suspensa (NEXT_PUBLIC_PRECOS_VISIVEL desligada)";

/** Para listas de rotas: `["/", ...comPrecos("/precos"), "/buscar"]` — com a página suspensa, o item sai. */
export function comPrecos<const T>(...itens: T[]): T[] {
  return PRECOS_SUSPENSA ? [] : itens;
}
