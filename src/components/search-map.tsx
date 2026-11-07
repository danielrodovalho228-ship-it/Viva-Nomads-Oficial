"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Property } from "@/lib/types";
import { cn } from "@/lib/utils";
import { precoDeBusca } from "@/lib/busca/painel-filtros";
import { rotuloPreco } from "@/lib/cartao-preco";
import { CardPinMapa } from "@/components/busca/card-pin-mapa";
import { usePreviaNoHover } from "@/components/busca/previa-hover";
import { ATRIBUICAO_MAPA, TILES_CARTO, avisarMapaSemChave, motorDoMapa } from "@/lib/mapa-base";
import { afastarPins } from "@/lib/busca/pins-sem-sobreposicao";
import { FOLGA_CARTAO_MAPA, deslocamentoParaCaber, fechaCartaoComTecla, mostrarCartaoNaTela } from "@/lib/busca/cartao-no-mapa";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!)
  );

/*
  Pino de preço do mapa (botão flutuante: shadow-flutuante). O realce troca SÓ cor, anel e camada, na hora:
  sem escala nem transição (QA do #953 / t70). Com os pinos empilhados no mesmo ponto, o "scale-110" do
  ativo e o "hover:scale-105" animado do vizinho mudavam a caixa sob o ponteiro: o pino de baixo crescia por
  cima do alvo e nunca ficava estável.
*/
const PIN_BASE =
  "cursor-pointer select-none whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold tabular-nums shadow-flutuante transition-none";
const pinClass = (active: boolean) =>
  cn(PIN_BASE, active ? "z-20 bg-night text-white ring-2 ring-forest" : "z-10 bg-white text-ink ring-1 ring-line hover:ring-ink");

// Cor primária de marca (forest) para o traçado do raio.
const RADIUS_COLOR = "#123b26";
const RADIUS_SRC = "viva-radius";
const RADIUS_FILL = "viva-radius-fill";
const RADIUS_LINE = "viva-radius-line";

// Conversão km → graus (uma fonte só para o círculo real e a elipse do
// placeholder). 1 grau de latitude ≈ 111.19 km (raio da Terra · π/180).
const KM_PER_DEG = (Math.PI / 180) * 6371;
const kmToDegLat = (km: number) => km / KM_PER_DEG;
const kmToDegLng = (km: number, lat: number) =>
  kmToDegLat(km) / Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);

/** Polígono que aproxima um círculo de `radiusKm` ao redor de (lng,lat). */
function circlePolygon(
  lng: number,
  lat: number,
  radiusKm: number,
  steps = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] = [];
  const degLat = kmToDegLat(radiusKm);
  const degLng = kmToDegLng(radiusKm, lat);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    ring.push([lng + degLng * Math.cos(t), lat + degLat * Math.sin(t)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

/**
 * Mapa de resultados com pins de preço interativos e sincronia lista↔mapa
 * (rodada 11; comportamento do Furnished Finder, ordem ca0e7dad): passar o
 * mouse no pin SÓ destaca o pin (e o card da lista); clicar abre o card do
 * imóvel ancorado no mapa, sem sair da página. Com NEXT_PUBLIC_MAPBOX_TOKEN renderiza o Mapbox GL; sem o
 * token, Leaflet com o mapa-base Voyager da CARTO (ordem ca0e7dad: mapa real sempre).
 */
interface SearchMapProps {
  properties: Property[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  /** Imóvel com o card aberto no mapa (clique no pin). */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Endereço buscado (geocoding) — centro do raio, recebe um marcador próprio. */
  focus?: { lat: number; lng: number } | null;
  /** Raio (km) desenhado ao redor do endereço buscado. */
  radiusKm?: number;
  className?: string;
}

/**
 * E525 (D11): afasta os pins que se cobrem (cada um vai à posição livre mais próxima). Por MARGEM, não por transform:
 * o pin já usa o translate do Tailwind (Leaflet) e o transform do próprio marcador (Mapbox).
 */
function aplicarAfastamento(itens: { id: string; x: number; y: number; el: HTMLElement }[], quadro: { w: number; h: number }) {
  const desloc = afastarPins(
    itens.map(({ id, x, y, el }) => ({ id, x, y, w: el.offsetWidth, h: el.offsetHeight })),
    quadro
  );
  for (const { id, el } of itens) {
    const { dx, dy } = desloc.get(id) ?? { dx: 0, dy: 0 };
    el.style.marginLeft = `${dx}px`;
    el.style.marginTop = `${dy}px`;
  }
}

/** E524 (D10): com o cartão do pin aberto, Esc fecha (antes só clicando no cartão dava para sair). */
function useFecharCartaoComEsc(aberto: boolean, fechar: () => void) {
  const fecharRef = useRef(fechar);
  useEffect(() => {
    fecharRef.current = fechar;
  });
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (fechaCartaoComTecla(e.key)) fecharRef.current();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);
}

export function SearchMap(props: SearchMapProps) {
  if (motorDoMapa(TOKEN) === "leaflet") return <SearchMapLeaflet {...props} />;
  return <SearchMapbox {...props} />;
}

/* ------------------------------------------------------------------ */
/* Mapbox real (token presente)                                        */
/* ------------------------------------------------------------------ */

function SearchMapbox({
  properties,
  activeId,
  onHover,
  selectedId = null,
  onSelect,
  focus,
  radiusKm = 10,
  className,
}: SearchMapProps) {
  const [popupEl] = useState(() => (typeof document === "undefined" ? null : document.createElement("div")));
  const onSelectRef = useRef(onSelect);
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
  // E442: prévia do cartão no hover do preço (o mesmo cartão do clique).
  const previa = usePreviaNoHover();
  const previaRef = useRef(previa);
  useEffect(() => {
    previaRef.current = previa;
  });
  /** O cartão aberto: o do clique (fica) ou o da prévia do hover. */
  const abertoId = selectedId ?? previa.id;
  // E442: entrar no cartão mantém a prévia aberta (dá para clicar); sair fecha com a mesma folga do preço.
  useEffect(() => {
    if (!popupEl) return;
    popupEl.addEventListener("mouseenter", previa.manter);
    popupEl.addEventListener("mouseleave", previa.sair);
    return () => {
      popupEl.removeEventListener("mouseenter", previa.manter);
      popupEl.removeEventListener("mouseleave", previa.sair);
    };
  }, [popupEl, previa.manter, previa.sair]);
  const propsRef = useRef(properties);
  const focusRef = useRef(focus);
  useEffect(() => {
    onHoverRef.current = onHover;
    onSelectRef.current = onSelect;
    propsRef.current = properties;
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
      el.className = pinClass(p.id === activeId || p.id === selectedId);
      el.dataset.testid = "pin-mapa";
      el.dataset.id = p.id;
      el.textContent = rotuloPreco({ mensal: precoDeBusca(p) }).valor;
      // E442: o hover no preço abre o cartão (prévia); sair fecha com folga para chegar ao cartão.
      el.addEventListener("mouseenter", () => {
        onHoverRef.current(p.id);
        previaRef.current.entrarPin(p.id);
      });
      el.addEventListener("mouseleave", () => {
        onHoverRef.current(null);
        previaRef.current.sair();
      });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current?.(p.id);
      });
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .addTo(map);
      markersRef.current.set(p.id, { marker, el });
    });
    const reorganizar = () =>
      aplicarAfastamento(
        [...markersRef.current].map(([id, { marker, el }]) => {
          const pt = map.project(marker.getLngLat());
          return { id, x: pt.x, y: pt.y, el };
        }),
        { w: map.getContainer().clientWidth, h: map.getContainer().clientHeight }
      );
    reorganizar();
    // E525: também ao ganhar tamanho (no celular o mapa nasce escondido e os pins mediam 0 × 0).
    map.on("moveend resize", reorganizar);
    return () => {
      map.off("moveend resize", reorganizar);
    };
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
        "grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-night text-white shadow-flutuante";
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

  // Clicar no mapa (fora de um pin) fecha o card.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const fechar = () => {
      onSelectRef.current?.(null);
      previaRef.current.limpar();
    };
    map.on("click", fechar);
    return () => {
      map.off("click", fechar);
    };
  }, []);

  // Realce do pin (hover ou aberto) — hover NÃO abre nada, só muda a cor.
  useEffect(() => {
    markersRef.current.forEach(({ el }, id) => {
      el.className = pinClass(id === activeId || id === abertoId);
    });
  }, [activeId, abertoId, sig]);

  // Card do imóvel ancorado no pin clicado.
  useEffect(() => {
    const map = mapRef.current;
    popupRef.current?.remove();
    popupRef.current = null;
    const p = abertoId ? propsRef.current.find((x) => x.id === abertoId) : null;
    if (!map || !p || !popupEl) return;
    popupRef.current = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 18, maxWidth: "none", className: "vn-popup" })
      .setLngLat([p.lng, p.lat])
      .setDOMContent(popupEl)
      .addTo(map);
    // E524 (D10): o Mapbox não tem autoPan — com o cartão já desenhado, move o mapa até ele caber, longe do zoom.
    const quadro = requestAnimationFrame(() => {
      const { dx, dy } = deslocamentoParaCaber(popupEl.getBoundingClientRect(), map.getContainer().getBoundingClientRect());
      if (dx || dy) map.panBy([-dx, -dy], { duration: 250 });
      mostrarCartaoNaTela(popupEl);
    });
    return () => cancelAnimationFrame(quadro);
  }, [abertoId, sig, popupEl]);

  const aberto = abertoId ? properties.find((x) => x.id === abertoId) : null;
  const fechar = () => {
    onSelect?.(null);
    previa.limpar();
  };
  useFecharCartaoComEsc(!!aberto, fechar);

  return (
    <>
      <div ref={containerRef} data-testid="mapa-busca" className={cn("overflow-hidden rounded-xl border border-line", className)} />
      {aberto && popupEl && createPortal(<CardPinMapa property={aberto} onFechar={fechar} />, popupEl)}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Leaflet + CARTO Voyager (mapa real; chave gratuita da CARTO)         */
/* ------------------------------------------------------------------ */

/**
 * Sem NEXT_PUBLIC_MAPBOX_TOKEN, o mapa da busca usa Leaflet com o mapa-base
 * Voyager da CARTO. Pins de preço em HTML (mesma marca do Mapbox), realce em
 * sincronia com a lista e clique abrindo o card do imóvel.
 */
/**
 * Enquadra todos os pins (+ endereço buscado). Chamado ao trocar os resultados e
 * quando o painel ganha tamanho (o mapa nasce antes do layout assentar).
 */
function enquadrarMapa(map: L.Map, list: Property[], focus?: { lat: number; lng: number } | null) {
  map.invalidateSize();
  const pts: L.LatLngExpression[] = list.map((p) => [p.lat, p.lng]);
  if (focus) pts.push([focus.lat, focus.lng]);
  if (pts.length === 1) map.setView(pts[0], 14);
  else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 14 });
}

function SearchMapLeaflet({ properties, activeId, onHover, selectedId = null, onSelect, focus, radiusKm = 10, className }: SearchMapProps) {
  const [popupEl] = useState(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    L.DomEvent.disableClickPropagation(el);
    return el;
  });
  const popupRef = useRef<L.Popup | null>(null);
  const onSelectRef = useRef(onSelect);
  const selRef = useRef(selectedId);
  const focusRef = useRef(focus);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // E698: o quadro do mapa nasce cinza até chegar o 1º tile; o aviso honesto cobre esse intervalo (e some sozinho).
  const [quadro, setQuadro] = useState<HTMLDivElement | null>(null);
  const [tilesProntos, setTilesProntos] = useState(!TILES_CARTO);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: L.Marker; el: HTMLElement }>>(new Map());
  const reorganizarRef = useRef<(() => void) | null>(null);
  const focusLayerRef = useRef<L.LayerGroup | null>(null);

  const onHoverRef = useRef(onHover);
  // E442: prévia do cartão no hover do preço (o mesmo cartão do clique).
  const previa = usePreviaNoHover();
  const previaRef = useRef(previa);
  useEffect(() => {
    previaRef.current = previa;
  });
  /** O cartão aberto: o do clique (fica) ou o da prévia do hover. */
  const abertoId = selectedId ?? previa.id;
  // E442: entrar no cartão mantém a prévia aberta (dá para clicar); sair fecha com a mesma folga do preço.
  useEffect(() => {
    if (!popupEl) return;
    popupEl.addEventListener("mouseenter", previa.manter);
    popupEl.addEventListener("mouseleave", previa.sair);
    return () => {
      popupEl.removeEventListener("mouseenter", previa.manter);
      popupEl.removeEventListener("mouseleave", previa.sair);
    };
  }, [popupEl, previa.manter, previa.sair]);
  const propsRef = useRef(properties);
  const activeRef = useRef(activeId);
  useEffect(() => {
    onHoverRef.current = onHover;
    onSelectRef.current = onSelect;
    propsRef.current = properties;
    activeRef.current = activeId;
    selRef.current = selectedId;
    focusRef.current = focus;
  });

  const sig = properties.map((p) => p.id).join("|");
  const focusKey = focus ? `${focus.lat},${focus.lng},${radiusKm}` : "";

  // Inicializa o mapa uma vez; acompanha o tamanho do contêiner (painel fixo).
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, scrollWheelZoom: true }).setView([-18.911, -48.262], 12);
    L.control.zoom({ position: "topright" }).addTo(map);
    if (TILES_CARTO) {
      const camada = L.tileLayer(TILES_CARTO, {
        maxZoom: 19,
        attribution: ATRIBUICAO_MAPA,
        // E698: pede os tiles já durante o arrasto/zoom e guarda uma margem — a base chega antes de os pinos parecerem soltos.
        updateWhenIdle: false,
        keepBuffer: 3,
      });
      camada.once("load", () => setTilesProntos(true));
      camada.addTo(map);
    } else {
      avisarMapaSemChave();
    }
    map.on("click", () => {
      onSelectRef.current?.(null);
      previaRef.current.limpar();
    });
    mapRef.current = map;
    // Ao ganhar tamanho pela 1ª vez, enquadra; depois só ajusta o tamanho.
    let enquadrado = false;
    const ro = new ResizeObserver(([e]) => {
      if (!e || e.contentRect.height < 10) return;
      if (!enquadrado) {
        enquadrado = true;
        enquadrarMapa(map, propsRef.current, focusRef.current);
      } else map.invalidateSize();
      // E525: no celular o mapa nasce escondido (pins medidos com 0 × 0); ao aparecer, os pins são afastados de novo.
      reorganizarRef.current?.();
    });
    ro.observe(containerRef.current);
    const markers = markersRef.current;
    // Rede lenta ou tiles que não chegam: o aviso não fica para sempre (o erro de tile é tratado à parte, E419).
    const limite = window.setTimeout(() => setTilesProntos(true), 10_000);
    return () => {
      window.clearTimeout(limite);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, []);

  // (Re)cria os pins quando o conjunto de resultados muda e enquadra tudo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current.clear();
    const list = propsRef.current;
    list.forEach((p) => {
      const icon = L.divIcon({
        className: "",
        iconSize: [0, 0],
        html: `<div data-testid="pin-mapa" data-id="${esc(p.id)}" class="${pinClass(p.id === activeRef.current || p.id === selRef.current)} absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2">${esc(rotuloPreco({ mensal: precoDeBusca(p) }).valor)}</div>`,
      });
      // E442: sem `title` — a etiqueta nativa do navegador era o "texto simples" no lugar do cartão.
      const marker = L.marker([p.lat, p.lng], { icon, riseOnHover: true, alt: p.title }).addTo(map);
      const el = marker.getElement()!.firstElementChild as HTMLElement;
      // E442: o hover no preço abre o cartão (prévia); sair fecha com folga para chegar ao cartão.
      el.addEventListener("mouseenter", () => {
        onHoverRef.current(p.id);
        previaRef.current.entrarPin(p.id);
      });
      el.addEventListener("mouseleave", () => {
        onHoverRef.current(null);
        previaRef.current.sair();
      });
      marker.on("click", () => onSelectRef.current?.(p.id));
      markersRef.current.set(p.id, { marker, el });
    });
    enquadrarMapa(map, list, focusRef.current);
    const reorganizar = () =>
      aplicarAfastamento(
        [...markersRef.current].map(([id, { marker, el }]) => {
          const pt = map.latLngToContainerPoint(marker.getLatLng());
          return { id, x: pt.x, y: pt.y, el };
        }),
        { w: map.getContainer().clientWidth, h: map.getContainer().clientHeight }
      );
    reorganizar();
    reorganizarRef.current = reorganizar;
    map.on("zoomend moveend", reorganizar);
    return () => {
      map.off("zoomend moveend", reorganizar);
    };
  }, [sig, focusKey]);

  // Centro do endereço buscado + círculo do raio.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    focusLayerRef.current?.remove();
    focusLayerRef.current = null;
    if (!focus) return;
    const g = L.layerGroup().addTo(map);
    L.circle([focus.lat, focus.lng], {
      radius: radiusKm * 1000,
      color: RADIUS_COLOR,
      weight: 1.5,
      opacity: 0.5,
      dashArray: "4 4",
      fillColor: RADIUS_COLOR,
      fillOpacity: 0.08,
    }).addTo(g);
    L.marker([focus.lat, focus.lng], {
      interactive: false,
      icon: L.divIcon({
        className: "",
        iconSize: [0, 0],
        html: '<div aria-label="Endereço buscado" class="absolute left-0 top-0 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-night shadow-flutuante"></div>',
      }),
    }).addTo(g);
    focusLayerRef.current = g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // Realce do pin (hover no card ou no pin, ou card aberto): só muda a cor e
  // traz o pin para a frente — hover não abre nada.
  useEffect(() => {
    markersRef.current.forEach(({ marker, el }, id) => {
      const on = id === activeId || id === abertoId;
      el.className = `${pinClass(on)} absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2`;
      el.dataset.ativo = on ? "1" : "0";
      marker.setZIndexOffset(on ? 1000 : 0);
    });
  }, [activeId, abertoId, sig]);

  // Card do imóvel ancorado no pin clicado (popup do Leaflet com o card React).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !popupEl) return;
    const p = abertoId ? propsRef.current.find((x) => x.id === abertoId) : null;
    if (!p) {
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }
    popupRef.current?.remove();
    // E524 (D10): o autoPan usa as folgas da casa — a da direita livra os botões de zoom (o padrão do Leaflet era 5 px).
    popupRef.current = L.popup({
      closeButton: false,
      autoClose: false,
      closeOnClick: false,
      offset: [0, -12],
      className: "vn-popup",
      maxWidth: 280,
      minWidth: 256,
      autoPan: true,
      autoPanPaddingTopLeft: [FOLGA_CARTAO_MAPA.esquerda, FOLGA_CARTAO_MAPA.topo],
      autoPanPaddingBottomRight: [FOLGA_CARTAO_MAPA.direita, FOLGA_CARTAO_MAPA.base],
    })
      .setLatLng([p.lat, p.lng])
      .setContent(popupEl)
      .openOn(map);
    // Com o cartão desenhado (foto, chips), refaz o enquadramento com o tamanho real.
    const quadro = requestAnimationFrame(() => {
      popupRef.current?.update();
      mostrarCartaoNaTela(popupEl);
    });
    return () => cancelAnimationFrame(quadro);
  }, [abertoId, sig, popupEl]);

  const aberto = abertoId ? properties.find((x) => x.id === abertoId) : null;
  const fechar = () => {
    onSelect?.(null);
    previa.limpar();
  };
  useFecharCartaoComEsc(!!aberto, fechar);

  return (
    <>
      <div
        ref={(el) => {
          containerRef.current = el;
          setQuadro(el);
        }}
        data-testid="mapa-busca"
        data-mapa-base={TILES_CARTO ? "carto" : "sem-chave"}
        data-mapa-tiles={tilesProntos ? "pronto" : "carregando"}
        className={cn("z-0 overflow-hidden bg-surface-2", className)}
      />
      {!tilesProntos && quadro && createPortal(<AvisoMapaCarregando />, quadro)}
      {aberto && popupEl && createPortal(<CardPinMapa property={aberto} onFechar={fechar} />, popupEl)}
    </>
  );
}

/** E698: aviso discreto sobre o quadro do mapa enquanto a base (ruas) ainda não chegou — o pino sozinho num fundo cinza parecia quebrado. */
function AvisoMapaCarregando() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[450] grid place-items-center bg-surface-2/60" data-testid="mapa-carregando" role="status" aria-live="polite">
      <span className="rounded-full bg-white px-3 py-2 text-sm font-medium text-ink motion-safe:animate-pulse">Carregando o mapa…</span>
    </div>
  );
}
