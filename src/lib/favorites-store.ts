import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoritesState {
  /** Dono destes favoritos (id do usuário). null = deslogado/sem dono. */
  owner: string | null;
  ids: string[];
  /** Prompt 49: favoritos do convidado que ainda não foram para a conta (mescla ao entrar). */
  pendente: string[];
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
  /**
   * Amarra os favoritos ao usuário logado. Convidado (sem dono) que entra: a lista do aparelho vira `pendente` e é
   * mesclada com a da conta (mesclarGuardadosDoConvidado). OUTRA conta no mesmo navegador: zera (T11).
   */
  bindUser: (userId: string | null) => void;
  /** Resultado da mescla: a lista da conta (já com os do aparelho) e nada pendente. */
  concluirMescla: (userId: string, ids: string[]) => void;
  /** Zera tudo (logout). */
  reset: () => void;
}

/**
 * Favoritos do inquilino. Persistidos em localStorage (convidado e modo demo) e
 * sincronizados best-effort com o Supabase via server action quando logado.
 * T11: guardam o DONO — favoritos de uma conta nunca aparecem para outra no
 * mesmo navegador, e são apagados no logout.
 */
export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      owner: null,
      ids: [],
      pendente: [],
      isFavorite: (id) => get().ids.includes(id),
      toggle: (id) =>
        set((s) => ({
          ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id],
        })),
      bindUser: (userId) =>
        set((s) => {
          if (s.owner === userId) return s;
          if (s.owner === null && userId && s.ids.length) return { owner: userId, ids: s.ids, pendente: s.ids };
          return { owner: userId, ids: [], pendente: [] };
        }),
      concluirMescla: (userId, ids) =>
        set((s) => (s.owner === userId ? { ids: [...new Set([...ids, ...s.ids.filter((x) => !s.pendente.includes(x))])], pendente: [] } : s)),
      reset: () => set({ owner: null, ids: [], pendente: [] }),
    }),
    { name: "vivanomads-favorites" }
  )
);
