"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HeartPulse,
  GraduationCap,
  Briefcase,
  ShoppingCart,
  Dumbbell,
  Cross,
  Bus,
  MapPin,
  ExternalLink,
} from "lucide-react";
import type { Property } from "@/lib/types";

const CAT_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  hospital: { label: "Saúde", icon: HeartPulse },
  universidade: { label: "Educação", icon: GraduationCap },
  coworking: { label: "Trabalho", icon: Briefcase },
  mercado: { label: "Mercado", icon: ShoppingCart },
  academia: { label: "Academia", icon: Dumbbell },
  farmacia: { label: "Farmácia", icon: Cross },
  transporte: { label: "Transporte", icon: Bus },
};

interface Resolved {
  placeId: string;
  categoria: string;
  name: string;
  mapsUrl: string;
  distanceText?: string;
  durationText?: string;
  mode?: "walking" | "driving";
}

/**
 * Proximidades reais via Google (curadas pelo proprietário). No carregamento,
 * busca nome + distância em tempo real pela rota /api/places/distances (a chave
 * fica no servidor). Fallback elegante: sem chave/cota, mostra nome/rótulo e o
 * link do Maps, sem distância — nunca quebra. Some se não há lugares curados.
 */
export function GoogleProximities({ property }: { property: Property }) {
  const places = useMemo(() => property.googlePlaces ?? [], [property.googlePlaces]);
  const [items, setItems] = useState<Resolved[] | null>(null);

  useEffect(() => {
    if (places.length === 0) return;
    let alive = true;
    fetch("/api/places/distances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: { lat: property.lat, lng: property.lng },
        places: places.map((p) => ({ placeId: p.placeId, categoria: p.categoria, rotulo: p.rotulo })),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d?.places)) setItems(d.places as Resolved[]);
      })
      .catch(() => {
        // Fallback no cliente: rótulo + link, sem distância.
        if (alive)
          setItems(
            places.map((p) => ({
              placeId: p.placeId,
              categoria: p.categoria,
              name: p.rotulo || "Local",
              mapsUrl: `https://www.google.com/maps/place/?q=place_id:${p.placeId}`,
            }))
          );
      });
    return () => {
      alive = false;
    };
  }, [property.id, property.lat, property.lng, places]);

  if (places.length === 0) return null;

  return (
    <section aria-labelledby="proximidades-title">
      <h2 id="proximidades-title" className="font-title text-2xl font-bold text-ink">
        Proximidades
      </h2>

      {items === null ? (
        <p className="mt-4 text-sm text-muted">Calculando distâncias…</p>
      ) : (
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {items.map((p) => {
            const meta = CAT_META[p.categoria] ?? { label: p.categoria, icon: MapPin };
            const Icon = meta.icon;
            return (
              <li key={p.placeId} className="flex items-center gap-3 rounded-xl border border-sage-200 px-4 py-3">
                <Icon className="h-5 w-5 shrink-0 text-sage" />
                <span className="min-w-0 flex-1">
                  <a
                    href={p.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-forest"
                  >
                    {p.name} <ExternalLink className="h-3 w-3 shrink-0 text-muted" />
                  </a>
                  <span className="block text-xs text-muted">
                    {meta.label}
                    {p.distanceText
                      ? ` · ${p.distanceText}${p.durationText ? ` · ${p.durationText}${p.mode === "walking" ? " a pé" : " de carro"}` : ""}`
                      : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">Distâncias e nomes fornecidos pelo Google Maps.</p>
    </section>
  );
}
