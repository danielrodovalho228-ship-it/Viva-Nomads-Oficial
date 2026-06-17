"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin } from "lucide-react";
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
}: {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
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
    // Fallback elegante (sem texto técnico) enquanto o Mapbox não está configurado:
    // grade sutil de marca + chips de preço dos imóveis.
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-line bg-surface-2",
          className
        )}
      >
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(#e2e7ee 1px, transparent 1px), linear-gradient(90deg, #e2e7ee 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-200">
          <MapPin className="h-10 w-10" />
        </div>
        {markers.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 p-3">
            {markers.slice(0, 6).map((m) => (
              <span
                key={m.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow",
                  m.kind === "workspace" ? "bg-white text-blue-700" : "bg-blue-500 text-white"
                )}
              >
                <MapPin className="h-3 w-3" />
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
