import { useFavoritesStore } from "@/lib/favorites-store";
import { CHAVE_BUSCAS_CONVIDADO, lerLista } from "./guardados";

let emCurso = false;

/**
 * Prompt 49 — chamado sempre que a sessão é conferida (setUser). Sem nada guardado pelo convidado, não faz nada.
 * Com algo: manda para a conta (sem duplicar) e limpa a cópia do aparelho. Se a página fechar no meio, o pendente
 * continua guardado e a mescla roda na próxima abertura.
 */
export function mesclarGuardadosDoConvidado(userId: string | null | undefined): void {
  if (!userId || emCurso || typeof window === "undefined") return;
  const fav = useFavoritesStore.getState();
  const pendentes = fav.owner === userId ? fav.pendente : [];
  let buscas: string[] = [];
  try {
    buscas = lerLista(window.localStorage.getItem(CHAVE_BUSCAS_CONVIDADO));
  } catch {
    /* sem armazenamento: nada guardado */
  }
  if (!pendentes.length && !buscas.length) return;
  emCurso = true;
  void import("@/lib/data/convidado-actions")
    .then(async (a) => {
      if (pendentes.length) {
        const r = await a.mesclarFavoritosConvidado(pendentes);
        if (r.ok) useFavoritesStore.getState().concluirMescla(userId, r.ids);
      }
      if (buscas.length) {
        const r = await a.mesclarBuscasConvidado(buscas);
        if (r.ok) {
          try {
            window.localStorage.removeItem(CHAVE_BUSCAS_CONVIDADO);
          } catch {
            /* idem */
          }
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      emCurso = false;
    });
}
