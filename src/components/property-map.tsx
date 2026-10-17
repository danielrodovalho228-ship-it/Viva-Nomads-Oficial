"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatBRL, cn } from "@/lib/utils";
import { ATRIBUICAO_MAPA, RAIO_APROXIMADO_KM, TILES_CARTO, avisarMapaSemChave, borrarCoordenada as blur, motorDoMapa } from "@/lib/mapa-base";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string; // ex.: preço ou nome
  kind?: "property" | "workspace";
}

const AREA_COLOR = "#123b26"; // primária de marca (forest)
const APPROX_RADIUS_KM = RAIO_APROXIMADO_KM; // raio da área aproximada exibida

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

interface PropertyMapProps {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  approximate?: boolean;
  className?: string;
}

/**
 * Mapa com marcadores. Mesmo caminho da /buscar (ordem b4fd5b18): com
 * NEXT_PUBLIC_MAPBOX_TOKEN, Mapbox GL; sem o token, Leaflet + mapa-base CARTO.
 *
 * Com `approximate`, mostra uma ÁREA aproximada (círculo do bairro) em vez do
 * ponto exato — o endereço exato só é liberado após o aceite (privacidade).
 */
export function PropertyMap(props: PropertyMapProps) {
  if (motorDoMapa(TOKEN) === "leaflet") return <PropertyMapLeaflet {...props} />;
  return <PropertyMapbox {...props} />;
}

function PropertyMapbox({ markers, center, zoom = 13, approximate = false, className }: PropertyMapProps) {
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

  if (!first) return <div className={cn("rounded-2xl border border-line bg-surface-2", className)} />;
  return <div ref={containerRef} className={cn("overflow-hidden rounded-2xl", className)} />;
}

/** Leaflet + CARTO (sem token Mapbox): área aproximada de ~500 m e lugares próximos. */
function PropertyMapLeaflet({ markers, center, zoom = 13, approximate = false, className }: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const raw = center ?? markers[0];
  const first = useMemo(
    () => (raw ? (approximate ? { lat: blur(raw.lat), lng: blur(raw.lng) } : raw) : undefined),
    [raw, approximate]
  );
  const shownMarkers = useMemo(
    () => (approximate ? markers.filter((m) => m.kind !== "property") : markers),
    [markers, approximate]
  );

  useEffect(() => {
    if (!containerRef.current || !first) return;
    const map = L.map(containerRef.current, { zoomControl: false, scrollWheelZoom: false }).setView(
      [first.lat, first.lng],
      approximate ? Math.min(zoom, 15) : zoom
    );
    // topleft: o canto direito é do botão "Ampliar mapa"
    L.control.zoom({ position: "topleft" }).addTo(map);
    if (TILES_CARTO) L.tileLayer(TILES_CARTO, { maxZoom: 19, attribution: ATRIBUICAO_MAPA }).addTo(map);
    else avisarMapaSemChave();

    if (approximate) {
      L.circle([first.lat, first.lng], {
        radius: APPROX_RADIUS_KM * 1000,
        color: AREA_COLOR,
        weight: 1.5,
        opacity: 0.5,
        dashArray: "4 4",
        fillColor: AREA_COLOR,
        fillOpacity: 0.1,
      }).addTo(map);
    }
    shownMarkers.forEach((m) => {
      const el = document.createElement("div");
      el.className =
        (m.kind === "workspace"
          ? "rounded-full border border-sage bg-white text-forest px-2 py-1 text-xs font-semibold shadow"
          : "rounded-full bg-forest text-white px-2.5 py-1 text-xs font-semibold shadow") +
        " absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap";
      el.textContent = m.label ?? "";
      L.marker([m.lat, m.lng], { icon: L.divIcon({ className: "", iconSize: [0, 0], html: el }), interactive: false }).addTo(map);
    });

    // O contêiner pode ganhar tamanho depois (tela cheia, layout assentando).
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
    };
  }, [shownMarkers, first, zoom, approximate]);

  if (!first) return <div className={cn("rounded-2xl border border-line bg-surface-2", className)} />;
  return (
    <div
      ref={containerRef}
      data-testid="mapa-imovel"
      data-mapa-base={TILES_CARTO ? "carto" : "sem-chave"}
      className={cn("z-0 overflow-hidden rounded-2xl bg-surface-2", className)}
    />
  );
}

/** Helper para formatar o rótulo de preço de um marcador de imóvel. */
export function priceLabel(price: number) {
  return formatBRL(price);
}
