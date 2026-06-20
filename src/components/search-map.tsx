"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin } from "lucide-react";
import type { Property } from "@/lib/types";
import { formatBRL, cn } from "@/lib/utils";
import { BrandImage } from "@/components/brand-image";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { ReadyToLiveBadge } from "@/components/ui/badge";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const isPhoto = (s?: string) =>
  typeof s === "string" && (/^https?:\/\//.test(s) || s.startsWith("/"));

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!)
  );

const PIN_BASE =
  "cursor-pointer select-none whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold shadow transition-transform";
const pinClass = (active: boolean) =>
  cn(
    PIN_BASE,
    active
      ? "z-20 scale-110 bg-night text-white ring-2 ring-champagne"
      : "z-10 bg-forest text-white"
  );

// Cor primária de marca (forest) para o traçado do raio.
const RADIUS_COLOR = "#143c8c";
const RADIUS_SRC = "viva-radius";
const RADIUS_FILL = "viva-radius-fill";
const RADIUS_LINE = "viva-radius-line";

/** Polígono que aproxima um círculo de `radiusKm` ao redor de (lng,lat). */
function circlePolygon(
  lng: number,
  lat: number,
  radiusKm: number,
  steps = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] = [];
  const earth = 6371; // km
  const lat0 = (lat * Math.PI) / 180;
  const degLat = (radiusKm / earth) * (180 / Math.PI);
  const degLng = degLat / Math.max(Math.cos(lat0), 1e-6);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    ring.push([lng + degLng * Math.cos(t), lat + degLat * Math.sin(t)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

/**
 * Mapa de resultados com pins de preço interativos e sincronia lista↔mapa
 * (rodada 11). Com NEXT_PUBLIC_MAPBOX_TOKEN renderiza o Mapbox GL real; sem o
 * token, cai para um placeholder de marca (pins posicionados por lat/lng
 * normalizada) — a app continua funcional em modo demonstração.
 */
export function SearchMap(props: {
  properties: Property[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  /** Endereço buscado (geocoding) — centro do raio, recebe um marcador próprio. */
  focus?: { lat: number; lng: number } | null;
  /** Raio (km) desenhado ao redor do endereço buscado. */
  radiusKm?: number;
  className?: string;
}) {
  if (!TOKEN) return <SearchMapPlaceholder {...props} />;
  return <SearchMapbox {...props} />;
}

/* ------------------------------------------------------------------ */
/* Mapbox real (token presente)                                        */
/* ------------------------------------------------------------------ */

function SearchMapbox({
  properties,
  activeId,
  onHover,
  focus,
  radiusKm = 10,
  className,
}: {
  properties: Property[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  focus?: { lat: number; lng: number } | null;
  radiusKm?: number;
  className?: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLElement }>>(
    new Map()
  );
  const focusMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // Refs com os valores mais recentes — para os listeners dos pins não
  // precisarem recriar o mapa a cada render.
  const onHoverRef = useRef(onHover);
  const propsRef = useRef(properties);
  const routerRef = useRef(router);
  const focusRef = useRef(focus);
  useEffect(() => {
    onHoverRef.current = onHover;
    propsRef.current = properties;
    routerRef.current = router;
    focusRef.current = focus;
  });

  // Assinatura estável do conjunto de resultados (ids), para só reconstruir os
  // marcadores quando a lista muda de fato — e não a cada re-render do pai.
  const sig = properties.map((p) => p.id).join("|");
  // Assinatura do centro buscado (geocoding) + raio, vazia quando não há endereço.
  const focusKey = focus ? `${focus.lat},${focus.lng},${radiusKm}` : "";

  // Inicializa o mapa uma única vez.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-48.262, -18.911], // Uberlândia (centro aproximado)
      zoom: 12,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // (Re)cria os marcadores quando o conjunto de resultados muda.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();

    const list = propsRef.current;
    if (list.length === 0) return;

    list.forEach((p) => {
      const el = document.createElement("div");
      el.className = pinClass(p.id === activeId);
      el.textContent = formatBRL(p.monthlyPrice);
      el.addEventListener("mouseenter", () => onHoverRef.current(p.id));
      el.addEventListener("mouseleave", () => onHoverRef.current(null));
      el.addEventListener("click", () => routerRef.current.push(`/imoveis/${p.id}`));
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      markersRef.current.set(p.id, { marker, el });
    });
    // O enquadramento (fitBounds) fica num efeito próprio keyed em [sig, focusKey]
    // para um único ajuste de câmera — evita animações concorrentes quando lista
    // e endereço mudam juntos (ex.: trocar o raio).
    // activeId é lido de propósito sem entrar nas deps: o realce é tratado no
    // efeito abaixo, para não reconstruir os marcadores a cada hover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  // Enquadra os resultados (+ centro buscado) num único fitBounds sempre que o
  // conjunto ou o endereço/raio mudam. Lê propsRef/focusRef no momento do ajuste.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const fit = () => {
      const list = propsRef.current;
      const f = focusRef.current;
      if (list.length === 0 && !f) return;
      const bounds = new mapboxgl.LngLatBounds();
      list.forEach((p) => bounds.extend([p.lng, p.lat]));
      if (f) bounds.extend([f.lng, f.lat]);
      map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 300 });
    };
    if (map.isStyleLoaded()) fit();
    else map.once("load", fit);
  }, [sig, focusKey]);

  // Marcador do endereço buscado (centro do raio) + círculo de raio.
  // O enquadramento é tratado pelo efeito de fit acima.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Se o estilo ainda não carregou, o desenho é adiado para o evento "load".
    // `cancelled` (via cleanup) impede um drawRadius de execução anterior — com
    // `focus` obsoleto — de desenhar um círculo fantasma depois de o efeito
    // ter rodado de novo com outro endereço (ou nenhum).
    let cancelled = false;
    const drawRadius = () => {
      if (cancelled) return;
      const data: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: focus ? [circlePolygon(focus.lng, focus.lat, radiusKm)] : [],
      };
      const src = map.getSource(RADIUS_SRC) as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData(data);
        return;
      }
      if (!focus) return;
      map.addSource(RADIUS_SRC, { type: "geojson", data });
      map.addLayer({
        id: RADIUS_FILL,
        type: "fill",
        source: RADIUS_SRC,
        paint: { "fill-color": RADIUS_COLOR, "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: RADIUS_LINE,
        type: "line",
        source: RADIUS_SRC,
        paint: {
          "line-color": RADIUS_COLOR,
          "line-width": 1.5,
          "line-opacity": 0.5,
          "line-dasharray": [2, 2],
        },
      });
    };
    if (map.isStyleLoaded()) drawRadius();
    else map.once("load", drawRadius);

    focusMarkerRef.current?.remove();
    focusMarkerRef.current = null;
    if (focus) {
      const el = document.createElement("div");
      el.className =
        "grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-night text-white shadow-lg ring-2 ring-champagne";
      el.setAttribute("aria-label", "Endereço buscado");
      el.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg>';
      focusMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([focus.lng, focus.lat])
        .addTo(map);
    }

    return () => {
      cancelled = true;
    };
    // focus/radiusKm são lidos via focusKey (que os resume); deps explícitas
    // reabririam o efeito sem necessidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Realce do pin ativo + mini-card (popup) sincronizados com a lista.
  useEffect(() => {
    const map = mapRef.current;
    markersRef.current.forEach(({ el }, id) => {
      el.className = pinClass(id === activeId);
    });

    popupRef.current?.remove();
    popupRef.current = null;
    if (!map || !activeId) return;
    const p = propsRef.current.find((x) => x.id === activeId);
    if (!p) return;

    popupRef.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      maxWidth: "200px",
    })
      .setLngLat([p.lng, p.lat])
      .setHTML(
        `<div class="w-44">
           <p class="line-clamp-1 text-sm font-semibold text-ink">${esc(p.title)}</p>
           <p class="text-xs text-muted">${esc(p.neighborhood)} · ${formatBRL(
             p.monthlyPrice
           )}/mês</p>
         </div>`
      )
      .addTo(map);
  }, [activeId, sig]);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden rounded-2xl border border-line", className)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Placeholder de marca (sem token — modo demonstração)                */
/* ------------------------------------------------------------------ */

function SearchMapPlaceholder({
  properties,
  activeId,
  onHover,
  focus,
  radiusKm = 10,
  className,
}: {
  properties: Property[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  focus?: { lat: number; lng: number } | null;
  radiusKm?: number;
  className?: string;
}) {
  if (properties.length === 0) {
    // Sem imóveis no resultado. Se há um endereço buscado (ex.: link
    // compartilhado com raio que não cobre nenhum imóvel), ainda mostramos o
    // centro e o raio centralizados — sem imóveis não há escala de referência,
    // então o círculo usa um tamanho fixo só como indicação visual.
    return (
      <div
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-2xl border border-line bg-surface-2 text-blue-200",
          className
        )}
      >
        {focus ? (
          <>
            <div
              style={{
                width: "55%",
                aspectRatio: "1 / 1",
                borderColor: RADIUS_COLOR,
                backgroundColor: `${RADIUS_COLOR}14`,
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
              aria-hidden
            />
            <div
              className="relative z-10 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-night text-white shadow-lg ring-2 ring-champagne"
              aria-label="Endereço buscado"
            >
              <MapPin className="h-4 w-4" />
            </div>
          </>
        ) : (
          <MapPin className="h-10 w-10" />
        )}
      </div>
    );
  }

  const lats = properties.map((p) => p.lat).concat(focus ? [focus.lat] : []);
  const lngs = properties.map((p) => p.lng).concat(focus ? [focus.lng] : []);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 1;
  const spanLng = maxLng - minLng || 1;
  // Padding interno (10%–90%) para os pins não colarem na borda.
  const posX = (lng: number) => 10 + ((lng - minLng) / spanLng) * 80;
  const posY = (lat: number) => 90 - ((lat - minLat) / spanLat) * 80; // lat maior = mais ao norte (topo)

  const activeProp = properties.find((p) => p.id === activeId) ?? null;

  // Diâmetro do raio em % do quadro (projeção linear → vira elipse, como o mapa
  // real distorce longe do equador). km → graus → fração do span exibido.
  const degLat = radiusKm / 111.19;
  const degLng = degLat / Math.max(Math.cos((focus?.lat ?? 0) * Math.PI / 180), 1e-6);
  const radiusW = focus ? (2 * degLng / spanLng) * 80 : 0;
  const radiusH = focus ? (2 * degLat / spanLat) * 80 : 0;

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

      {/* Círculo de raio ao redor do endereço buscado */}
      {focus && (
        <div
          style={{
            left: `${posX(focus.lng)}%`,
            top: `${posY(focus.lat)}%`,
            width: `${radiusW}%`,
            height: `${radiusH}%`,
            borderColor: RADIUS_COLOR,
            backgroundColor: `${RADIUS_COLOR}14`, // ~8% de opacidade
          }}
          className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed"
          aria-hidden
        />
      )}

      {/* Centro do endereço buscado (geocoding) */}
      {focus && (
        <div
          style={{ left: `${posX(focus.lng)}%`, top: `${posY(focus.lat)}%` }}
          className="absolute z-30 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-night text-white shadow-lg ring-2 ring-champagne"
          aria-label="Endereço buscado"
        >
          <MapPin className="h-4 w-4" />
        </div>
      )}

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
