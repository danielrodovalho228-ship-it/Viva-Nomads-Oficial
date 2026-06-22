"use client";

import { useEffect, useMemo, useRef } from "react";
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

const AREA_COLOR = "#143c8c"; // primária de marca (forest)
const APPROX_RADIUS_KM = 0.5; // raio da área aproximada exibida

/** Arredonda ~3 casas (≈110 m) para não expor o ponto exato (privacidade). */
const blur = (n: number) => Math.round(n * 1000) / 1000;

/** Polígono que aproxima um círculo de `radiusKm` ao redor de (lng,lat). */
function circle(lng: number, lat: number, radiusKm: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] = [];
  const degLat = (radiusKm / 6371) * (180 / Math.PI);
  const degLng = degLat / Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    ring.push([lng + degLng * Math.cos(t), lat + degLat * Math.sin(t)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

/**
 * Mapa com marcadores (Mapbox GL). Sem NEXT_PUBLIC_MAPBOX_TOKEN, exibe um
 * placeholder marcado, mantendo a app funcional em modo demonstração.
 *
 * Com `approximate`, mostra uma ÁREA aproximada (círculo do bairro) em vez do
 * ponto exato — o endereço exato só é liberado após o aceite (privacidade).
 */
export function PropertyMap({
  markers,
  center,
  zoom = 13,
  approximate = false,
  className,
}: {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  approximate?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const raw = center ?? markers[0];
  // Em modo aproximado, embaralha levemente o centro e esconde o pino do imóvel.
  const first = useMemo(
    () => (raw ? (approximate ? { lat: blur(raw.lat), lng: blur(raw.lng) } : raw) : undefined),
    [raw, approximate]
  );
  const shownMarkers = useMemo(
    () => (approximate ? markers.filter((m) => m.kind !== "property") : markers),
    [markers, approximate]
  );

  useEffect(() => {
    if (!TOKEN || !containerRef.current || !first) return;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [first.lng, first.lat],
      zoom: approximate ? Math.min(zoom, 13) : zoom,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Área aproximada (círculo) no lugar do ponto exato.
    if (approximate) {
      map.on("load", () => {
        map.addSource("approx-area", { type: "geojson", data: circle(first.lng, first.lat, APPROX_RADIUS_KM) });
        map.addLayer({ id: "approx-fill", type: "fill", source: "approx-area", paint: { "fill-color": AREA_COLOR, "fill-opacity": 0.1 } });
        map.addLayer({ id: "approx-line", type: "line", source: "approx-area", paint: { "line-color": AREA_COLOR, "line-width": 1.5, "line-opacity": 0.5, "line-dasharray": [2, 2] } });
      });
    }

    shownMarkers.forEach((m) => {
      const el = document.createElement("div");
      el.className =
        m.kind === "workspace"
          ? "rounded-full bg-white text-forest border border-sage px-2 py-1 text-xs font-semibold shadow"
          : "rounded-full bg-forest text-white px-2.5 py-1 text-xs font-semibold shadow";
      el.textContent = m.label ?? "";
      new mapboxgl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map);
    });

    return () => map.remove();
  }, [shownMarkers, first, zoom, approximate]);

  if (!TOKEN || !first) {
    // Fallback elegante (sem texto técnico) enquanto o Mapbox não está configurado:
    // grade sutil de marca + área aproximada / chips de preço.
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
        {approximate ? (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
            style={{ width: "55%", aspectRatio: "1 / 1", borderColor: AREA_COLOR, backgroundColor: `${AREA_COLOR}1a` }}
            aria-label="Área aproximada do imóvel"
          />
        ) : (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-200">
            <MapPin className="h-10 w-10" />
          </div>
        )}
        {shownMarkers.length > 0 && (
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 p-3">
            {shownMarkers.slice(0, 6).map((m) => (
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
