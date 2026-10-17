"use client";

import { useFavoritesStore } from "@/lib/favorites-store";
import { useProperties } from "@/lib/use-properties";

/** Imóveis favoritados (mesma lista do coração, no site público e no painel). */
export function useFavoritos() {
  const ids = useFavoritesStore((s) => s.ids);
  const { properties, loading } = useProperties("/api/properties");
  return { ids, loading, favoritos: properties.filter((p) => ids.includes(p.id)) };
}
