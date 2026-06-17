"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { formatBRL, cn } from "@/lib/utils";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string; // ex.: preço ou nome
  kind?: "property" | "workspace";
}

/**
 * Mapa com marcadores (Mapbox GL). Sem NEXT_PUBLIC_MAPBOX_TOKEN, exibe um
 * placeholder marcado, mantendo a app funcional em modo demonstração.
 */
export function PropertyMap({
  markers,
  center,
  zoom = 13,
  className,
  placeholderLabel = "[MAPA — configure NEXT_PUBLIC_MAPBOX_TOKEN]",
}: {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  placeholderLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const first = center ?? markers[0];

  useEffect(() => {
    if (!TOKEN || !containerRef.current || !first) return;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [first.lng, first.lat],
      zoom,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    markers.forEach((m) => {
      const el = document.createElement("div");
      el.className =
        m.kind === "workspace"
          ? "rounded-full bg-white text-forest border border-sage px-2 py-1 text-xs font-semibold shadow"
          : "rounded-full bg-forest text-white px-2.5 py-1 text-xs font-semibold shadow";
      el.textContent = m.label ?? "";
      new mapboxgl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map);
    });

    return () => map.remove();
  }, [markers, first, zoom]);

  if (!TOKEN || !first) {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl", className)}>
        <PhotoPlaceholder label={placeholderLabel} className="h-full w-full" />
        {markers.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 p-3">
            {markers.slice(0, 5).map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-forest shadow"
              >
                {m.label}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <div ref={containerRef} className={cn("overflow-hidden rounded-2xl", className)} />;
}

/** Helper para formatar o rótulo de preço de um marcador de imóvel. */
export function priceLabel(price: number) {
  return formatBRL(price);
}
