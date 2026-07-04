"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, ChevronDown, MapPin, ArrowRight, Users } from "lucide-react";
import type { Property } from "@/lib/types";
import { PropertyCard } from "@/components/property-card";
import { SearchMap } from "@/components/search-map";
import { EmptySearchIllustration } from "@/components/illustrations";
import { Map as MapIcon, List as ListIcon } from "lucide-react";
import { cn, distanceKm } from "@/lib/utils";
import { tierFromPhotoCount, searchPriority } from "@/lib/listing";
import { LocationSearch } from "@/components/location-search";
import type { GeoSuggestion } from "@/lib/integrations/geocoding";
import { PROPERTY_TYPES } from "@/lib/amenities";
import { FAIXAS, GARANTIAS_FAIXA } from "@/lib/faixas";

/** Raio (km) padrão ao redor de um endereço geocodificado. */
const DEFAULT_RADIUS_KM = 10;

/** Normaliza o tipo do imóvel (chave canônica ou rótulo legado) p/ a chave. */
function typeValue(pt: string): string {
  const low = pt.toLowerCase();
  if (PROPERTY_TYPES.some((t) => t.value === low)) return low;
  const m = PROPERTY_TYPES.find(
    (t) => t.label.toLowerCase() === low || t.label.toLowerCase().startsWith(low)
  );
  return m?.value ?? low;
}

/** Uma propriedade aceita a garantia escolhida no filtro? */
function aceitaGarantia(p: Property, g: string): boolean {
  if (!g) return true;
  const arr = p.garantiasAceitas ?? [];
  if (g === "seguro_fianca") return arr.includes("seguro_fianca") || !!p.acceptsInsurance;
  return arr.includes(g); // caucao_avista | caucao_parcelada | titulo
}

export function SearchClient({ properties }: { properties: Property[] }) {
  const [locationQuery, setLocationQuery] = useState("");
  // Coordenadas de um endereço escolhido no autocomplete (filtra por raio).
  const [geoCenter, setGeoCenter] = useState<{ lat: number; lng: number } | null>(null);
  // Raio (km) ao redor do endereço buscado — ajustável quando há endereço.
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [maxPrice, setMaxPrice] = useState(0);
  const [minBedrooms, setMinBedrooms] = useState(0);
  // Hóspedes (Onda 1): adultos + crianças → filtra pela capacidade do imóvel.
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [maxPeriod, setMaxPeriod] = useState(0); // período mínimo aceito <= X
  const [typeFilter, setTypeFilter] = useState(""); // tipo de imóvel ("" = todos)
  const [faixa, setFaixa] = useState(""); // faixa de prazo ("" = todas)
  const [dataEntrada, setDataEntrada] = useState(""); // disponível até esta data de entrada
  const [garantia, setGarantia] = useState(""); // "" | caucao_avista | caucao_parcelada | titulo | seguro_fianca
  const [petsOnly, setPetsOnly] = useState(false);
  const [furnishedOnly, setFurnishedOnly] = useState(false);
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

  // Restaura a busca da URL: endereço/raio + todos os filtros, para links
  // compartilhados e reloads mostrarem exatamente os filtros ativos (M7).
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
    const num = (k: string) => Number(sp.get(k)) || 0;
    if ([2500, 3500, 5000].includes(num("preco"))) setMaxPrice(num("preco"));
    if ([1, 2, 3].includes(num("quartos"))) setMinBedrooms(num("quartos"));
    if (num("adultos") >= 1) setAdults(Math.min(16, num("adultos")));
    if (num("criancas") >= 1) setChildren(Math.min(10, num("criancas")));
    if ([30, 60, 90].includes(num("periodo"))) setMaxPeriod(num("periodo"));
    const ordem = sp.get("ordem");
    if (ordem === "recent" || ordem === "price-asc" || ordem === "price-desc") setSort(ordem);
    const tipo = sp.get("tipo");
    if (tipo && PROPERTY_TYPES.some((t) => t.value === tipo)) setTypeFilter(tipo);
    const fx = sp.get("faixa");
    if (fx && FAIXAS.some((f) => f.key === fx)) setFaixa(fx);
    const ent = sp.get("entrada");
    if (ent && /^\d{4}-\d{2}-\d{2}$/.test(ent)) setDataEntrada(ent);
    const gar = sp.get("garantia");
    if (gar && GARANTIAS_FAIXA.some((g) => g.key === gar)) setGarantia(gar);
    const on = (k: string) => sp.get(k) === "1";
    if (on("pet")) setPetsOnly(true);
    if (on("mobiliado")) setFurnishedOnly(true);
    if (on("pronto")) setReadyToLiveOnly(true);
    if (on("homeoffice")) setHomeOfficeOnly(true);
    if (on("localizado")) setWorkLocatedOnly(true);
    if (on("nota")) setInvoiceOnly(true);
    if (on("seguro")) setInsuranceOnly(true);
    if (on("gestor")) setOperatedOnly(true);
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
    const put = (k: string, on: boolean, v: string) => (on ? params.set(k, v) : params.delete(k));
    put("preco", maxPrice > 0, String(maxPrice));
    put("quartos", minBedrooms > 0, String(minBedrooms));
    put("adultos", adults > 1, String(adults));
    put("criancas", children > 0, String(children));
    put("periodo", maxPeriod > 0, String(maxPeriod));
    put("tipo", !!typeFilter, typeFilter);
    put("faixa", !!faixa, faixa);
    put("entrada", !!dataEntrada, dataEntrada);
    put("garantia", !!garantia, garantia);
    put("ordem", sort !== "relevance", sort);
    put("pet", petsOnly, "1");
    put("mobiliado", furnishedOnly, "1");
    put("pronto", readyToLiveOnly, "1");
    put("homeoffice", homeOfficeOnly, "1");
    put("localizado", workLocatedOnly, "1");
    put("nota", invoiceOnly, "1");
    put("seguro", insuranceOnly, "1");
    put("gestor", operatedOnly, "1");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    );
  }, [
    locationQuery, geoCenter, radiusKm, maxPrice, minBedrooms, adults, children, maxPeriod, sort,
    typeFilter, faixa, dataEntrada, garantia, petsOnly, furnishedOnly,
    readyToLiveOnly, homeOfficeOnly, workLocatedOnly, invoiceOnly, insuranceOnly, operatedOnly,
  ]);

  // Zera todos os filtros (usado no estado vazio para o usuário recomeçar).
  function clearFilters() {
    setLocationQuery("");
    setGeoCenter(null);
    setRadiusKm(DEFAULT_RADIUS_KM);
    setMaxPrice(0);
    setMinBedrooms(0);
    setAdults(1);
    setChildren(0);
    setMaxPeriod(0);
    setTypeFilter("");
    setFaixa("");
    setDataEntrada("");
    setGarantia("");
    setPetsOnly(false);
    setFurnishedOnly(false);
    setReadyToLiveOnly(false);
    setHomeOfficeOnly(false);
    setWorkLocatedOnly(false);
    setInvoiceOnly(false);
    setInsuranceOnly(false);
    setOperatedOnly(false);
    setSort("relevance");
  }

  const results = useMemo(() => {
    const loc = locationQuery.trim().toLowerCase();
    // Distância calculada UMA vez por imóvel quando há endereço — reusada no
    // filtro por raio e na ordenação por proximidade (evita recomputar o
    // haversine N + ~2·N·log N vezes a cada digitação).
    const dist = geoCenter
      ? new Map(
          properties.map((p) => [p.id, distanceKm(geoCenter.lat, geoCenter.lng, p.lat, p.lng)])
        )
      : null;
    let list = properties.filter((p) => {
      // Com endereço geocodificado, filtra por raio; senão, por nome (bairro/cidade).
      if (dist) {
        if (dist.get(p.id)! > radiusKm) return false;
      } else if (loc && !`${p.neighborhood} ${p.city}`.toLowerCase().includes(loc)) {
        return false;
      }
      if (maxPrice && p.monthlyPrice > maxPrice) return false;
      if (minBedrooms && p.bedrooms < minBedrooms) return false;
      // Hóspedes: só exclui quando a capacidade É conhecida e menor que o total
      // (imóveis sem capacidade cadastrada continuam aparecendo — não some estoque).
      if (p.maxGuests != null && p.maxGuests < adults + children) return false;
      if (maxPeriod && p.minPeriodDays > maxPeriod) return false;
      if (typeFilter && typeValue(p.propertyType) !== typeFilter) return false;
      if (faixa && !(p.faixasAceitas ?? []).includes(faixa)) return false;
      if (dataEntrada && p.availableFrom && p.availableFrom > dataEntrada) return false;
      if (garantia && !aceitaGarantia(p, garantia)) return false;
      if (petsOnly && !p.petsAllowed) return false;
      if (furnishedOnly && !p.furnished) return false;
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
    else if (dist)
      list = [...list].sort((a, b) => dist.get(a.id)! - dist.get(b.id)!);
    else
      list = [...list].sort(
        (a, b) =>
          searchPriority(tierFromPhotoCount(b.photos.length)) -
          searchPriority(tierFromPhotoCount(a.photos.length))
      );
    return list;
  }, [properties, locationQuery, geoCenter, radiusKm, maxPrice, minBedrooms, adults, children, maxPeriod, typeFilter, faixa, dataEntrada, garantia, petsOnly, furnishedOnly, readyToLiveOnly, homeOfficeOnly, workLocatedOnly, invoiceOnly, insuranceOnly, operatedOnly, sort]);

  const activeCount =
    (maxPrice ? 1 : 0) +
    (minBedrooms ? 1 : 0) +
    (adults > 1 || children > 0 ? 1 : 0) +
    (maxPeriod ? 1 : 0) +
    (typeFilter ? 1 : 0) +
    (faixa ? 1 : 0) +
    (dataEntrada ? 1 : 0) +
    (garantia ? 1 : 0) +
    [petsOnly, furnishedOnly, readyToLiveOnly, homeOfficeOnly, workLocatedOnly, invoiceOnly, insuranceOnly, operatedOnly].filter(
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
            label="Ordenar resultados"
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
            label="Tipo de imóvel"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[["", "Tipo de imóvel"], ...PROPERTY_TYPES.map((t) => [t.value, t.label] as [string, string])]}
          />
          <Select
            label="Faixa de prazo"
            value={faixa}
            onChange={setFaixa}
            options={[["", "Faixa de prazo"], ...FAIXAS.map((f) => [f.key, `${f.label} · ${f.resumo}`] as [string, string])]}
          />
          <Select
            label="Garantia aceita"
            value={garantia}
            onChange={setGarantia}
            options={[["", "Garantia aceita"], ...GARANTIAS_FAIXA.map((g) => [g.key, g.label] as [string, string])]}
          />
          <label className="inline-flex items-center gap-2 rounded-full border border-sage-200 bg-white px-4 py-2 text-sm text-ink">
            <span className="text-muted">Entrada até</span>
            <input
              type="date"
              value={dataEntrada}
              onChange={(e) => setDataEntrada(e.target.value)}
              aria-label="Data de entrada desejada"
              className="bg-transparent text-ink outline-none focus:text-forest"
            />
          </label>
          <Select
            label="Preço máximo"
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
            label="Quartos (mínimo)"
            value={String(minBedrooms)}
            onChange={(v) => setMinBedrooms(Number(v))}
            options={[
              ["0", "Quartos"],
              ["1", "1+ quarto"],
              ["2", "2+ quartos"],
              ["3", "3+ quartos"],
            ]}
          />
          <GuestsPicker
            adults={adults}
            childrenCount={children}
            onAdults={setAdults}
            onChildren={setChildren}
          />
          <Select
            label="Período mínimo aceito"
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
          <Chip on={furnishedOnly} onClick={() => setFurnishedOnly((v) => !v)}>
            🛋️ Mobiliado
          </Chip>
          <Chip on={petsOnly} onClick={() => setPetsOnly((v) => !v)}>
            🐾 Aceita pet
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
              <p className="mt-4 font-title text-lg font-bold text-ink">
                Ainda não há imóveis para esta busca
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Ajuste os filtros ou volte em breve — novos imóveis entram toda semana.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-sage-200 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-sage hover:bg-surface-2"
              >
                Limpar filtros
              </button>
              <Link
                href="/qualificar"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest hover:text-blue-700"
              >
                É proprietário? Anuncie seu imóvel <ArrowRight className="h-4 w-4" />
              </Link>
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
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
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

/**
 * Seletor de hóspedes estilo Airbnb (adultos + crianças). O total filtra pela
 * capacidade do imóvel (max_guests). Imóveis sem capacidade cadastrada não são
 * escondidos (ver filtro em `results`).
 */
function GuestsPicker({
  adults,
  childrenCount,
  onAdults,
  onChildren,
}: {
  adults: number;
  childrenCount: number;
  onAdults: (n: number) => void;
  onChildren: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = adults + childrenCount;
  const ativo = adults > 1 || childrenCount > 0;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Hóspedes"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm outline-none",
          ativo ? "border-sage text-forest" : "border-sage-200 text-ink focus:border-sage"
        )}
      >
        <Users className="h-4 w-4 text-sage" />
        {ativo ? (total === 1 ? "1 hóspede" : `${total} hóspedes`) : "Hóspedes"}
        <ChevronDown className="h-4 w-4 text-muted" />
      </button>
      {open && (
        <>
          {/* Backdrop invisível: clicar fora fecha. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute left-0 z-40 mt-2 w-64 rounded-2xl border border-sage-200 bg-white p-4 shadow-lg">
            <Stepper label="Adultos" hint="13 anos ou mais" value={adults} min={1} max={16} onChange={onAdults} />
            <div className="my-3 h-px bg-sage-200" />
            <Stepper label="Crianças" hint="até 12 anos" value={childrenCount} min={0} max={10} onChange={onChildren} />
          </div>
        </>
      )}
    </div>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Menos ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid h-8 w-8 place-items-center rounded-full border border-sage-200 text-lg leading-none text-forest transition-colors hover:border-sage disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <span className="w-5 text-center text-sm font-semibold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`Mais ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-8 w-8 place-items-center rounded-full border border-sage-200 text-lg leading-none text-forest transition-colors hover:border-sage disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
