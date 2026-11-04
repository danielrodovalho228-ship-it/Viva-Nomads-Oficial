/*
  E497 (família E456) — "mesma URL, dois conteúdos": a página de ÁREA decide o modo pela própria URL, no 1º render,
  igual no servidor e no cliente (antes, o modo vinha do aparelho e o SincronizarPapel trocava DEPOIS da pintura). PURO.
*/
import { papelDaRota, modoDoPapel } from "./papel-ativo.ts";

/** "owner" numa página da área do dono, "tenant" na do morador; null em página comum (decide o modo em uso). */
export function modoDaRota(pathname: string | null | undefined): "owner" | "tenant" | null {
  const papel = papelDaRota(pathname ?? undefined, false);
  return papel ? (modoDoPapel(papel) ?? null) : null;
}
