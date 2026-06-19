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
  className,
}: {
  properties: Property[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  className?: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLElement }>>(
    new Map()
  );
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // Refs com os valores mais recentes — para os listeners dos pins não
  // precisarem recriar o mapa a cada render.
  const onHoverRef = useRef(onHover);
  const propsRef = useRef(properties);
  const routerRef = useRef(router);
  useEffect(() => {
    onHoverRef.current = onHover;
    propsRef.current = properties;
    routerRef.current = router;
  });

  // Assinatura estável do conjunto de resultados (ids), para só reconstruir os
  // marcadores quando a lista muda de fato — e não a cada re-render do pai.
  const sig = properties.map((p) => p.id).join("|");

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

    const bounds = new mapboxgl.LngLatBounds();
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
      bounds.extend([p.lng, p.lat]);
    });

    const fit = () =>
      map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 });
    if (map.isStyleLoaded()) fit();
    else map.once("load", fit);
    // activeId é lido de propósito sem entrar nas deps: o realce é tratado no
    // efeito abaixo para não reconstruir os marcadores a cada hover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

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
