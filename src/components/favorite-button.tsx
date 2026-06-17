"use client";

import { Heart } from "lucide-react";
import { useFavoritesStore } from "@/lib/favorites-store";
import { toggleFavorite } from "@/lib/data/actions";
import { cn } from "@/lib/utils";

/** Botão de favoritar (coração). Persiste no store e sincroniza best-effort. */
export function FavoriteButton({
  propertyId,
  className,
}: {
  propertyId: string;
  className?: string;
}) {
  const isFavorite = useFavoritesStore((s) => s.ids.includes(propertyId));
  const toggle = useFavoritesStore((s) => s.toggle);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !isFavorite;
    toggle(propertyId);
    void toggleFavorite(propertyId, next);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow transition-colors hover:bg-white",
        className
      )}
    >
      <Heart
        className={cn(
          "h-4.5 w-4.5 transition-colors",
          isFavorite ? "fill-red-500 text-red-500" : "text-forest"
        )}
      />
    </button>
  );
}
