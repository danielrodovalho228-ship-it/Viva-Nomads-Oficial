"use client";

import { Heart } from "lucide-react";
import { useFavoritesStore } from "@/lib/favorites-store";
import { toggleFavorite } from "@/lib/data/actions";
import { cn } from "@/lib/utils";
import { registrarEvento } from "@/lib/eventos/registrar";

/** Botão de favoritar (coração). Persiste no store e sincroniza best-effort (mesma regra de sempre: quem pode favoritar não muda). */
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
    if (next) registrarEvento("favoritar", { imovelId: propertyId });
  }

  // 1 toque salva, outro desfaz (Prompt 40): botão de alternar com aria-pressed. O nome
  // acessível acompanha a ação ("Adicionar"/"Remover"), como os testes e leitores de tela já usam.
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      data-testid="coracao"
      className={cn(
        "grid h-11 w-11 place-items-center rounded-full bg-white/90 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest",
        className
      )}
    >
      <Heart
        aria-hidden
        className={cn("h-5 w-5 transition-colors", isFavorite ? "fill-forest text-forest" : "text-ink")}
      />
    </button>
  );
}
