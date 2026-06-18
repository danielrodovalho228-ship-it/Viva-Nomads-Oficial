"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import type { Property } from "@/lib/types";
import { PropertyCard } from "@/components/property-card";
import { PropertyMap } from "@/components/property-map";
import { EmptySearchIllustration } from "@/components/illustrations";
import { formatBRL } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function SearchClient({ properties }: { properties: Property[] }) {
  const [maxPrice, setMaxPrice] = useState(0);
  const [minBedrooms, setMinBedrooms] = useState(0);
  const [maxPeriod, setMaxPeriod] = useState(0); // período mínimo aceito <= X
  const [readyToLiveOnly, setReadyToLiveOnly] = useState(false);
  const [homeOfficeOnly, setHomeOfficeOnly] = useState(false);
  const [workLocatedOnly, setWorkLocatedOnly] = useState(false);
  const [condoOnly, setCondoOnly] = useState(false);
  const [invoiceOnly, setInvoiceOnly] = useState(false);
  const [insuranceOnly, setInsuranceOnly] = useState(false);
  const [operatedOnly, setOperatedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false); // acordeão de filtros no mobile
  const [sort, setSort] = useState<"relevance" | "price-asc" | "price-desc">("relevance");

  const results = useMemo(() => {
    let list = properties.filter((p) => {
      if (maxPrice && p.monthlyPrice > maxPrice) return false;
      if (minBedrooms && p.bedrooms < minBedrooms) return false;
      if (maxPeriod && p.minPeriodDays > maxPeriod) return false;
      if (readyToLiveOnly && !p.readyToLiveBadge) return false;
      if (homeOfficeOnly && !p.tagHomeOffice) return false;
      if (workLocatedOnly && !p.tagWorkLocated) return false;
      if (condoOnly && !p.tagCondoApproved) return false;
      if (invoiceOnly && !p.issuesInvoice) return false;
      if (insuranceOnly && !p.acceptsInsurance) return false;
      if (operatedOnly && !(p.ownershipType === "subleased" && p.subleaseAuthorized)) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => a.monthlyPrice - b.monthlyPrice);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.monthlyPrice - a.monthlyPrice);
    return list;
  }, [properties, maxPrice, minBedrooms, maxPeriod, readyToLiveOnly, homeOfficeOnly, workLocatedOnly, condoOnly, invoiceOnly, insuranceOnly, operatedOnly, sort]);

  const activeCount =
    (maxPrice ? 1 : 0) +
    (minBedrooms ? 1 : 0) +
    (maxPeriod ? 1 : 0) +
    [readyToLiveOnly, homeOfficeOnly, workLocatedOnly, condoOnly, invoiceOnly, insuranceOnly, operatedOnly].filter(
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
          <Chip on={condoOnly} onClick={() => setCondoOnly((v) => !v)}>
            🏢 Aceito em condomínio
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

      <p className="mt-4 text-sm text-muted">
        {results.length} {results.length === 1 ? "imóvel encontrado" : "imóveis encontrados"}
      </p>

      {/* Lista (60%) + Mapa (40%) */}
      <div className="mt-4 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
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
                <PropertyCard key={p.id} property={p} />
              ))}
            </div>
          )}
        </div>

        {/* Mapa Mapbox com marcadores de preço (Fase 6) */}
        <div className="hidden lg:col-span-2 lg:block">
          <div className="sticky top-20">
            <PropertyMap
              className="h-[600px] w-full border border-sage-200"
              markers={results.map((p) => ({
                id: p.id,
                lat: p.lat,
                lng: p.lng,
                label: formatBRL(p.monthlyPrice),
                kind: "property",
              }))}
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
