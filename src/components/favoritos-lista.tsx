"use client";

import { GitCompare } from "lucide-react";
import { PropertyCard } from "@/components/property-card";
import { ButtonLink } from "@/components/ui/button";
import { useFavoritos } from "@/lib/use-favoritos";

/** Lista pública de favoritos (guardados no navegador; logado, é a mesma do painel). */
export function FavoritosLista() {
  const { favoritos, ids, loading } = useFavoritos();
  return (
    <div className="container-page py-6" data-testid="favoritos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-title text-2xl font-bold text-ink">Favoritos ({ids.length})</h1>
        {favoritos.length >= 2 && (
          <ButtonLink href="/dashboard/comparar" variant="gold">
            <GitCompare className="h-4 w-4" /> Comparar
          </ButtonLink>
        )}
      </div>
      {ids.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-line bg-white p-5" data-testid="favoritos-vazio">
          <p className="text-ink">Nenhum favorito ainda. Toque no coração dos imóveis que gostar para guardá-los aqui.</p>
          <ButtonLink href="/buscar" variant="primary" className="mt-3">
            Explorar imóveis
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-4 grid auto-rows-fr gap-6 sm:grid-cols-2 xl:grid-cols-4" data-testid="favoritos-grade" aria-busy={loading}>
          {favoritos.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  );
}
