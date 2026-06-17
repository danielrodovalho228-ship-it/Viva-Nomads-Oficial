import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoritesState {
  ids: string[];
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
}

/**
 * Favoritos do inquilino. Persistidos em localStorage (modo demo) e
 * sincronizados best-effort com o Supabase via server action quando logado.
 */
export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      isFavorite: (id) => get().ids.includes(id),
      toggle: (id) =>
        set((s) => ({
          ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id],
        })),
    }),
    { name: "vivanomads-favorites" }
  )
);
