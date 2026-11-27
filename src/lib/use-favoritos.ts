"use client";

import { useFavoritesStore } from "@/lib/favorites-store";
import { useAuthStore } from "@/lib/store";
import { useProperties } from "@/lib/use-properties";
import { favoritosProntos } from "@/lib/favoritos-prontos";

/**
 * Imóveis favoritados (mesma lista do coração, no site público e no painel).
 * E535: `pronto` diz quando a lista já pode ser contada (imóveis carregados e, logado, a lista da conta já chegou).
 */
export function useFavoritos() {
  const ids = useFavoritesStore((s) => s.ids);
  const sincronizado = useFavoritesStore((s) => s.sincronizado);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const authChecked = useAuthStore((s) => s.authChecked);
  const { properties, loading } = useProperties("/api/properties");
  return {
    ids,
    loading,
    favoritos: properties.filter((p) => ids.includes(p.id)),
    pronto: favoritosProntos({ loading, authChecked, userId, sincronizado }),
  };
}
