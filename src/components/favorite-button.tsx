"use client";

import { Heart } from "lucide-react";
import { useFavoritesStore } from "@/lib/favorites-store";
import { toggleFavorite } from "@/lib/data/actions";
import { cn } from "@/lib/utils";
import { registrarEvento } from "@/lib/eventos/registrar";
import { useAuthStore } from "@/lib/store";
import { armazenamentoDisponivel, armazenamentoDoNavegador } from "@/lib/convidado/guardados";
import { urlEntrada } from "@/lib/auth/entrada";

/**
 * Botão de favoritar (coração). Persiste no store e sincroniza best-effort (mesma regra de sempre: quem pode favoritar não muda).
 * Prompt 49: o convidado favorita sem conta (fica no aparelho e vai para a conta quando ele entrar); sem armazenamento no
 * navegador, o coração pede a conta e volta para a mesma página.
 */
export function FavoriteButton({
  propertyId,
  className,
}: {
  propertyId: string;
  className?: string;
}) {
  const isFavorite = useFavoritesStore((s) => s.ids.includes(propertyId));
  const toggle = useFavoritesStore((s) => s.toggle);
  const logado = useAuthStore((s) => !!s.user);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!logado && !armazenamentoDisponivel(armazenamentoDoNavegador())) {
      window.location.assign(urlEntrada("favorito", window.location.pathname + window.location.search));
      return;
    }
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
