"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, ChevronDown, MapPin } from "lucide-react";
import type { Property } from "@/lib/types";
import { PropertyCard } from "@/components/property-card";
import { SearchMap } from "@/components/search-map";
import { EmptySearchIllustration } from "@/components/illustrations";
import { Map as MapIcon, List as ListIcon } from "lucide-react";
import { cn, distanceKm } from "@/lib/utils";
import { tierFromPhotoCount, searchPriority } from "@/lib/listing";
import { LocationSearch } from "@/components/location-search";
import type { GeoSuggestion } from "@/lib/integrations/geocoding";

/** Raio (km) padrão ao redor de um endereço geocodificado. */
const DEFAULT_RADIUS_KM = 10;

export function SearchClient({ properties }: { properties: Property[] }) {
  const [locationQuery, setLocationQuery] = useState("");
  // Coordenadas de um endereço escolhido no autocomplete (filtra por raio).
  const [geoCenter, setGeoCenter] = useState<{ lat: number; lng: number } | null>(null);
  // Raio (km) ao redor do endereço buscado — ajustável quando há endereço.
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [maxPrice, setMaxPrice] = useState(0);
  const [minBedrooms, setMinBedrooms] = useState(0);
  const [maxPeriod, setMaxPeriod] = useState(0); // período mínimo aceito <= X
  const [readyToLiveOnly, setReadyToLiveOnly] = useState(false);
  const [homeOfficeOnly, setHomeOfficeOnly] = useState(false);
  const [workLocatedOnly, setWorkLocatedOnly] = useState(false);
  const [invoiceOnly, setInvoiceOnly] = useState(false);
  const [insuranceOnly, setInsuranceOnly] = useState(false);
  const [operatedOnly, setOperatedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false); // acordeão de filtros no mobile
  const [activeId, setActiveId] = useState<string | null>(null); // sincronia lista↔mapa
  const [mobileTab, setMobileTab] = useState<"list" | "map">("list");
  const [sort, setSort] = useState<"relevance" | "recent" | "price-asc" | "price-desc">("relevance");

  // Pula a 1ª execução do efeito de sync (no mount, com estado ainda vazio):
  // como os setState da restauração são assíncronos, deixar o sync rodar no
  // mount apagaria os parâmetros da URL antes do estado restaurado committar.
  const skipNextSync = useRef(true);

  // Restaura a busca da URL: rótulo (?local=), endereço (?lat=&lng=) e raio (?r=).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const local = sp.get("local");
    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));
    const r = Number(sp.get("r"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (local) setLocationQuery(local);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
      setGeoCenter({ lat, lng });
      if ([5, 10, 20].includes(r)) setRadiusKm(r);
    }
  }, []);

  // Reflete a busca atual na URL (replaceState — sem recarregar nem rolar),
  // para o endereço e o raio serem compartilháveis / sobreviverem a um reload.
  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const label = locationQuery.trim();
    if (label) params.set("local", label);
    else params.delete("local");
    if (geoCenter) {
      params.set("lat", geoCenter.lat.toFixed(6));
      params.set("lng", geoCenter.lng.toFixed(6));
      params.set("r", String(radiusKm));
    } else {
      params.delete("lat");
      params.delete("lng");
      params.delete("r");
    }
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    );
  }, [locationQuery, geoCenter, radiusKm]);

  const results = useMemo(() => {
    const loc = locationQuery.trim().toLowerCase();
    let list = properties.filter((p) => {
      // Com endereço geocodificado, filtra por raio; senão, por nome (bairro/cidade).
      if (geoCenter) {
        if (distanceKm(geoCenter.lat, geoCenter.lng, p.lat, p.lng) > radiusKm) return false;
      } else if (loc && !`${p.neighborhood} ${p.city}`.toLowerCase().includes(loc)) {
        return false;
      }
      if (maxPrice && p.monthlyPrice > maxPrice) return false;
      if (minBedrooms && p.bedrooms < minBedrooms) return false;
      if (maxPeriod && p.minPeriodDays > maxPeriod) return false;
      if (readyToLiveOnly && !p.readyToLiveBadge) return false;
      if (homeOfficeOnly && !p.tagHomeOffice) return false;
      if (workLocatedOnly && !p.tagWorkLocated) return false;
      if (invoiceOnly && !p.issuesInvoice) return false;
      if (insuranceOnly && !p.acceptsInsurance) return false;
      if (operatedOnly && !(p.ownershipType === "subleased" && p.subleaseAuthorized)) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => a.monthlyPrice - b.monthlyPrice);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.monthlyPrice - a.monthlyPrice);
    // Adicionados recentemente: mais novos (data de cadastro) primeiro.
    else if (sort === "recent")
      list = [...list].sort(
        (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
      );
    // Relevância com endereço: mais perto primeiro; senão, anúncios mais completos.
    else if (geoCenter)
      list = [...list].sort(
        (a, b) =>
          distanceKm(geoCenter.lat, geoCenter.lng, a.lat, a.lng) -
          distanceKm(geoCenter.lat, geoCenter.lng, b.lat, b.lng)
      );
    else
      list = [...list].sort(
        (a, b) =>
          searchPriority(tierFromPhotoCount(b.photos.length)) -
          searchPriority(tierFromPhotoCount(a.photos.length))
      );
    return list;
  }, [properties, locationQuery, geoCenter, radiusKm, maxPrice, minBedrooms, maxPeriod, readyToLiveOnly, homeOfficeOnly, workLocatedOnly, invoiceOnly, insuranceOnly, operatedOnly, sort]);

  const activeCount =
    (maxPrice ? 1 : 0) +
    (minBedrooms ? 1 : 0) +
    (maxPeriod ? 1 : 0) +
    [readyToLiveOnly, homeOfficeOnly, workLocatedOnly, invoiceOnly, insuranceOnly, operatedOnly].filter(
      Boolean
    ).length;

  return (
    <div className="container-page py-6">
      {/* Filtros (acordeão no mobile, sempre abertos no sm+) */}
      <div className="rounded-2xl border border-sage-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="flex items-center gap-2 text-sm font-medium text-forest sm:pointer-events-none"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filtros
            {activeCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-forest px-1.5 text-xs font-semibold text-white">
                {activeCount}
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform sm:hidden",
                filtersOpen && "rotate-180"
              )}
            />
          </button>
          <Select
            value={sort}
            onChange={(v) => setSort(v as typeof sort)}
            options={[
              ["relevance", "Relevância"],
              ["recent", "Adicionados recentemente"],
              ["price-asc", "Menor preço"],
              ["price-desc", "Maior preço"],
            ]}
          />
        </div>

        <div
          className={cn(
            "mt-3 flex-wrap items-center gap-2.5 sm:flex",
            filtersOpen ? "flex" : "hidden"
          )}
        >
          {/* Localização: geocoding de endereço (Mapbox) ou bairros por nome */}
          <LocationSearch
            value={locationQuery}
            onChange={(text) => {
              setLocationQuery(text);
              setGeoCenter(null);
            }}
            onSelect={(s: GeoSuggestion) => {
              setLocationQuery(s.label);
              setGeoCenter({ lat: s.lat, lng: s.lng });
            }}
          />
          {geoCenter && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-sage-200 bg-surface-2 py-1 pl-3 pr-1.5 text-sm text-ink">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              <span className="text-muted">Raio</span>
              <select
                value={String(radiusKm)}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                aria-label="Raio de busca"
                className="rounded-full bg-transparent py-1 pl-1 pr-0.5 font-medium text-ink outline-none focus:text-forest"
              >
                {[5, 10, 20].map((km) => (
                  <option key={km} value={km}>
                    {km} km
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setLocationQuery("");
                  setGeoCenter(null);
                  setRadiusKm(DEFAULT_RADIUS_KM);
                }}
                className="rounded-full px-2 py-1 font-medium text-forest hover:bg-white"
                title="Limpar endereço"
              >
                limpar
              </button>
            </div>
          )}
          <Select
            value={String(maxPrice)}
            onChange={(v) => setMaxPrice(Number(v))}
            options={[
              ["0", "Qualquer preço"],
              ["2500", "Até R$ 2.500"],
              ["3500", "Até R$ 3.500"],
              ["5000", "Até R$ 5.000"],
            ]}
          />
          <Select
            value={String(minBedrooms)}
            onChange={(v) => setMinBedrooms(Number(v))}
            options={[
              ["0", "Quartos"],
              ["1", "1+ quarto"],
              ["2", "2+ quartos"],
              ["3", "3+ quartos"],
            ]}
          />
          <Select
            value={String(maxPeriod)}
            onChange={(v) => setMaxPeriod(Number(v))}
            options={[
              ["0", "Período"],
              ["30", "Aceita 30 dias"],
              ["60", "Aceita 60 dias"],
              ["90", "Aceita 90 dias"],
            ]}
          />

          <Chip on={readyToLiveOnly} onClick={() => setReadyToLiveOnly((v) => !v)} accent="gold">
            🏅 Pronto para Morar
          </Chip>
          <Chip on={homeOfficeOnly} onClick={() => setHomeOfficeOnly((v) => !v)}>
            💻 Para trabalhar de casa
          </Chip>
          <Chip on={workLocatedOnly} onClick={() => setWorkLocatedOnly((v) => !v)}>
            📍 Bem localizado
          </Chip>
          <Chip on={invoiceOnly} onClick={() => setInvoiceOnly((v) => !v)}>
            📄 Com Nota Fiscal
          </Chip>
          <Chip on={insuranceOnly} onClick={() => setInsuranceOnly((v) => !v)}>
            🛡️ Seguro-Fiança
          </Chip>
          <Chip on={operatedOnly} onClick={() => setOperatedOnly((v) => !v)}>
            🤝 Gestor profissional
          </Chip>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {results.length} {results.length === 1 ? "imóvel encontrado" : "imóveis encontrados"}
        </p>
        {/* Abas Lista/Mapa no mobile (não cabem lado a lado em 375px) */}
        <div className="flex rounded-full bg-surface-2 p-0.5 lg:hidden">
          <button
            onClick={() => setMobileTab("list")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
              mobileTab === "list" ? "bg-forest text-white" : "text-muted"
            )}
          >
            <ListIcon className="h-4 w-4" /> Lista
          </button>
          <button
            onClick={() => setMobileTab("map")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
              mobileTab === "map" ? "bg-forest text-white" : "text-muted"
            )}
          >
            <MapIcon className="h-4 w-4" /> Mapa
          </button>
        </div>
      </div>

      {/* Lista (60%) + Mapa (40%) lado a lado no desktop; abas no mobile */}
      <div className="mt-4 grid gap-6 lg:grid-cols-5">
        <div className={cn("lg:col-span-3", mobileTab === "map" && "hidden lg:block")}>
          {results.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-line p-12 text-center">
              <EmptySearchIllustration />
              <p className="mt-4 font-title text-lg font-bold text-ink">Nenhum imóvel encontrado</p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Nenhum imóvel corresponde aos filtros. Tente ampliar o período, o preço ou
                remover o filtro Pronto para Morar.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {results.map((p) => (
                <div
                  key={p.id}
                  onMouseEnter={() => setActiveId(p.id)}
                  onMouseLeave={() => setActiveId(null)}
                  className={cn(
                    "rounded-2xl transition-all",
                    activeId === p.id && "ring-2 ring-champagne ring-offset-2"
                  )}
                >
                  <PropertyCard property={p} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mapa interativo com pins + sincronia lista↔mapa (rodada 11) */}
        <div className={cn("lg:col-span-2 lg:block", mobileTab === "list" && "hidden lg:block")}>
          <div className="lg:sticky lg:top-20">
            <SearchMap
              properties={results}
              activeId={activeId}
              onHover={setActiveId}
              focus={geoCenter}
              radiusKm={radiusKm}
              className="h-[420px] w-full lg:h-[600px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  on,
  onClick,
  accent,
  children,
}: {
  on: boolean;
  onClick: () => void;
  accent?: "gold";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        on
          ? accent === "gold"
            ? "border-champagne bg-champagne text-night"
            : "border-forest bg-forest text-white"
          : "border-sage-200 bg-white text-ink hover:border-sage"
      )}
    >
      {children}
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-sage-200 bg-white px-4 py-2 text-sm text-ink outline-none focus:border-sage"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
