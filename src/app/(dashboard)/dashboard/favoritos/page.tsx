"use client";

import { GitCompare } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { PropertyCard } from "@/components/property-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyTripIllustration } from "@/components/illustrations";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { useFavoritesStore } from "@/lib/favorites-store";

export default function FavoritesPage() {
  const ids = useFavoritesStore((s) => s.ids);
  const favorites = SAMPLE_PROPERTIES.filter((p) => ids.includes(p.id));

  return (
    <>
      <PageTitle
        title="Favoritos"
        subtitle="Imóveis que você salvou para comparar depois."
        action={
          favorites.length >= 2 ? (
            <ButtonLink href="/dashboard/comparar" variant="gold">
              <GitCompare className="h-4 w-4" /> Comparar
            </ButtonLink>
          ) : undefined
        }
      />

      {favorites.length === 0 ? (
        <EmptyState
          illustration={<EmptyTripIllustration />}
          title="Nenhum favorito ainda"
          text="Toque no coração dos imóveis que gostar para salvá-los aqui e comparar depois."
          action={
            <ButtonLink href="/buscar" variant="primary">
              Explorar imóveis
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </>
  );
}
