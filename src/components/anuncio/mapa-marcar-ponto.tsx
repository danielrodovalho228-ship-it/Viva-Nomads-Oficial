"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ATRIBUICAO_MAPA, TILES_CARTO, avisarMapaSemChave } from "@/lib/mapa-base";

/**
 * TIPO-CHACARA-B: mapa em que o dono marca o ponto da casa (toque no mapa ou arraste o pino). Leaflet com o mapa-base
 * CARTO (o mesmo da página do imóvel). O ponto marcado é o exato: o servidor guarda nas colunas privadas.
 */
export default function MapaMarcarPonto({
  ponto,
  centro,
  onMarcar,
}: {
  ponto: { lat: number; lng: number } | null;
  centro: { lat: number; lng: number };
  onMarcar: (p: { lat: number; lng: number }) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const pino = useRef<L.Marker | null>(null);
  const aoMarcar = useRef(onMarcar);
  useEffect(() => {
    aoMarcar.current = onMarcar;
  }, [onMarcar]);

  useEffect(() => {
    if (!caixa.current) return;
    const inicio = ponto ?? centro;
    const m = L.map(caixa.current, { zoomControl: true, scrollWheelZoom: false }).setView([inicio.lat, inicio.lng], ponto ? 15 : 12);
    if (TILES_CARTO) L.tileLayer(TILES_CARTO, { maxZoom: 19, attribution: ATRIBUICAO_MAPA }).addTo(m);
    else avisarMapaSemChave();
    m.on("click", (ev: L.LeafletMouseEvent) => aoMarcar.current({ lat: ev.latlng.lat, lng: ev.latlng.lng }));
    mapa.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(caixa.current);
    return () => {
      ro.disconnect();
      m.remove();
      mapa.current = null;
      pino.current = null;
    };
    // O mapa nasce uma vez; o pino acompanha o ponto no efeito de baixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!ponto) {
      pino.current?.remove();
      pino.current = null;
      return;
    }
    if (!pino.current) {
      const el = document.createElement("div");
      el.className = "h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-forest";
      pino.current = L.marker([ponto.lat, ponto.lng], { draggable: true, icon: L.divIcon({ className: "", iconSize: [0, 0], html: el }) }).addTo(m);
      pino.current.on("dragend", () => {
        const p = pino.current!.getLatLng();
        aoMarcar.current({ lat: p.lat, lng: p.lng });
      });
    } else pino.current.setLatLng([ponto.lat, ponto.lng]);
  }, [ponto]);

  return <div ref={caixa} className="z-0 h-64 w-full overflow-hidden rounded-xl bg-surface-2" data-testid="chacara-mapa" data-mapa-base={TILES_CARTO ? "carto" : "sem-chave"} />;
}
