"use client";

import { GitCompare } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { PropertyCard } from "@/components/property-card";
import { ButtonLink } from "@/components/ui/button";
import { FavoritosTabs } from "@/components/dashboard/favoritos-tabs";
import { useFavoritos } from "@/lib/use-favoritos";
import { SkeletonCartao } from "@/components/ui/skeleton";

export default function FavoritesPage() {
  const { favoritos: favorites, ids, loading } = useFavoritos();

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
      <FavoritosTabs />

      {loading && favorites.length === 0 && ids.length > 0 ? (
        <div className="grid auto-rows-fr gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" data-testid="favoritos-carregando">
          {ids.map((id) => (
            <SkeletonCartao key={id} />
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          title="Nenhum favorito ainda"
          text="Toque no coração dos imóveis que gostar para salvá-los aqui e comparar depois."
          action={
            <ButtonLink href="/buscar" variant="primary">
              Explorar imóveis
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid auto-rows-fr gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
          {favorites.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </>
  );
}
