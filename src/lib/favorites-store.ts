import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoritesState {
  /** Dono destes favoritos (id do usuário). null = deslogado/sem dono. */
  owner: string | null;
  ids: string[];
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
  /** Amarra os favoritos ao usuário logado; se for OUTRA conta, zera (T11). */
  bindUser: (userId: string | null) => void;
  /** Zera tudo (logout). */
  reset: () => void;
}

/**
 * Favoritos do inquilino. Persistidos em localStorage (modo demo) e
 * sincronizados best-effort com o Supabase via server action quando logado.
 * T11: guardam o DONO — favoritos de uma conta nunca aparecem para outra no
 * mesmo navegador, e são apagados no logout.
 */
export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      owner: null,
      ids: [],
      isFavorite: (id) => get().ids.includes(id),
      toggle: (id) =>
        set((s) => ({
          ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id],
        })),
      bindUser: (userId) =>
        set((s) => (s.owner === userId ? s : { owner: userId, ids: [] })),
      reset: () => set({ owner: null, ids: [] }),
    }),
    { name: "vivanomads-favorites" }
  )
);
