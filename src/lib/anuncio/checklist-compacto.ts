import type { ItemChecklist } from "./prontidao.ts";

/** Quantos itens do checklist aparecem de uma vez no painel (celular e app). */
export const MAX_ITENS_COMPACTO = 3;

/**
 * Checklist do painel, compacto: só o que falta, no máximo MAX_ITENS_COMPACTO.
 * Expandido mostra tudo, na ordem original. `ocultos` alimenta "Ver todos (N)".
 */
export function itensDoChecklist(
  itens: ItemChecklist[],
  expandido: boolean
): { visiveis: ItemChecklist[]; ocultos: number } {
  if (expandido) return { visiveis: itens, ocultos: 0 };
  const visiveis = itens.filter((i) => !i.ok).slice(0, MAX_ITENS_COMPACTO);
  return { visiveis, ocultos: itens.length - visiveis.length };
}
