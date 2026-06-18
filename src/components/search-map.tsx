"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Property } from "@/lib/types";
import { formatBRL, cn } from "@/lib/utils";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { ReadyToLiveBadge } from "@/components/ui/badge";

const isPhoto = (s?: string) =>
  typeof s === "string" && (/^https?:\/\//.test(s) || s.startsWith("/"));

/**
 * Mapa de resultados com pins de preço interativos e sincronia lista↔mapa
 * (rodada 11). Posiciona os pins por lat/lng normalizada sobre um fundo de
 * marca — funciona sem token de mapa (demo) e fica pronto para o Mapbox real.
 */
export function SearchMap({
  properties,
  activeId,
  onHover,
  className,
}: {
  properties: Property[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  className?: string;
}) {
  if (properties.length === 0) {
    return (
      <div className={cn("grid place-items-center rounded-2xl border border-line bg-surface-2 text-blue-200", className)}>
        <MapPin className="h-10 w-10" />
      </div>
    );
  }

  const lats = properties.map((p) => p.lat);
  const lngs = properties.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 1;
  const spanLng = maxLng - minLng || 1;
  // Padding interno (10%–90%) para os pins não colarem na borda.
  const posX = (lng: number) => 10 + ((lng - minLng) / spanLng) * 80;
  const posY = (lat: number) => 90 - ((lat - minLat) / spanLat) * 80; // lat maior = mais ao norte (topo)

  const activeProp = properties.find((p) => p.id === activeId) ?? null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line bg-surface-2",
        className
      )}
    >
      {/* Grade sutil de marca */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(#e2e7ee 1px, transparent 1px), linear-gradient(90deg, #e2e7ee 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {properties.map((p) => {
        const active = p.id === activeId;
        return (
          <Link
            key={p.id}
            href={`/imoveis/${p.id}`}
            onMouseEnter={() => onHover(p.id)}
            onMouseLeave={() => onHover(null)}
            style={{ left: `${posX(p.lng)}%`, top: `${posY(p.lat)}%` }}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-xs font-bold shadow transition-all",
              active
                ? "z-20 scale-110 bg-night text-white ring-2 ring-champagne"
                : "z-10 bg-forest text-white hover:scale-105"
            )}
          >
            {formatBRL(p.monthlyPrice)}
          </Link>
        );
      })}

      {/* Mini-card do imóvel em destaque (hover) */}
      {activeProp && (
        <div
          style={{
            left: `${Math.min(72, Math.max(2, posX(activeProp.lng) - 14))}%`,
            top: `${Math.min(60, Math.max(2, posY(activeProp.lat) + 6))}%`,
          }}
          className="pointer-events-none absolute z-30 w-48 overflow-hidden rounded-xl border border-line bg-white shadow-xl"
        >
          <div className="relative aspect-[16/10]">
            {isPhoto(activeProp.photos[0]) ? (
              <BrandImage
                src={activeProp.photos[0]}
                alt={activeProp.title}
                rounded="rounded-none"
                treat={false}
                sizes="200px"
                className="h-full w-full"
              />
            ) : (
              <PhotoPlaceholder label={activeProp.photos[0]} className="h-full w-full" />
            )}
            {activeProp.readyToLiveBadge && (
              <div className="absolute left-2 top-2">
                <ReadyToLiveBadge size="sm" />
              </div>
            )}
          </div>
          <div className="p-2.5">
            <p className="line-clamp-1 text-sm font-semibold text-ink">{activeProp.title}</p>
            <p className="text-xs text-muted">
              {activeProp.neighborhood} · {formatBRL(activeProp.monthlyPrice)}/mês
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
