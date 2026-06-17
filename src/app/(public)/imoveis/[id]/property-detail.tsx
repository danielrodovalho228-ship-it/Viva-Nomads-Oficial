"use client";

import { useState } from "react";
import {
  Bath,
  BedDouble,
  Ruler,
  MapPin,
  Check,
  Wifi,
  Building2,
  Coffee,
  Users,
  CalendarCheck,
  MessageSquare,
  FileSignature,
} from "lucide-react";
import type { Property, WorkspaceType } from "@/lib/types";
import { formatBRL, cn } from "@/lib/utils";
import { WorkReadyBadge } from "@/components/ui/badge";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { Button, ButtonLink } from "@/components/ui/button";
import { PropertyCard } from "@/components/property-card";
import { PropertyMap, type MapMarker } from "@/components/property-map";

const TABS = [
  "Visão Geral",
  "Comodidades",
  "Espaço de Trabalho",
  "Disponibilidade",
  "Localização",
  "Proprietário",
] as const;

const WORKSPACE_ICONS: Record<WorkspaceType, React.ComponentType<{ className?: string }>> = {
  coworking: Building2,
  meeting_room: Users,
  cafe: Coffee,
};

const WORKSPACE_LABEL: Record<WorkspaceType, string> = {
  coworking: "Coworking",
  meeting_room: "Sala de reunião",
  cafe: "Café de trabalho",
};

export function PropertyDetail({
  property,
  similar,
}: {
  property: Property;
  similar: Property[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Visão Geral");
  const [activePhoto, setActivePhoto] = useState(0);

  // Marcador do imóvel + marcadores dos espaços de trabalho próximos.
  // Coords dos workspaces derivadas da distância (offset determinístico).
  const propertyMarker: MapMarker = {
    id: property.id,
    lat: property.lat,
    lng: property.lng,
    label: "Imóvel",
    kind: "property",
  };
  const workspaceMarkers: MapMarker[] = property.nearbyWorkspaces.map((w, i) => {
    const offset = (w.distanceM / 111000) * (i % 2 === 0 ? 1 : -1);
    return {
      id: w.name,
      lat: property.lat + offset,
      lng: property.lng + offset * 0.8,
      label: w.name,
      kind: "workspace",
    };
  });

  return (
    <div className="container-page py-8">
      {/* Galeria */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-3">
          <PhotoPlaceholder
            label={property.photos[activePhoto]}
            className="aspect-[16/10] w-full rounded-2xl"
          />
          {property.workReadyBadge && (
            <div className="absolute left-4 top-4">
              <WorkReadyBadge />
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-3 md:grid-cols-1">
          {property.photos.map((p, i) => (
            <button
              key={i}
              onClick={() => setActivePhoto(i)}
              className={cn(
                "overflow-hidden rounded-xl border-2",
                i === activePhoto ? "border-champagne" : "border-transparent"
              )}
            >
              <PhotoPlaceholder label={`#${i + 1}`} className="aspect-square w-full" />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* Conteúdo + abas */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            <MapPin className="h-4 w-4" /> {property.neighborhood}, {property.city} -{" "}
            {property.state}
          </div>
          <h1 className="mt-2 font-title text-3xl font-extrabold text-ink">{property.title}</h1>

          <div className="mt-4 flex flex-wrap gap-5 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <BedDouble className="h-4 w-4" /> {property.bedrooms} quartos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bath className="h-4 w-4" /> {property.bathrooms} banheiros
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Ruler className="h-4 w-4" /> {property.areaM2} m²
            </span>
          </div>

          {/* Abas */}
          <div className="mt-8 flex flex-wrap gap-1 border-b border-sage-200">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  tab === t
                    ? "border-forest text-forest"
                    : "border-transparent text-muted hover:text-forest"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {tab === "Visão Geral" && (
              <p className="leading-relaxed text-ink/90">{property.description}</p>
            )}

            {tab === "Comodidades" && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {property.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-sm text-ink">
                    <Check className="h-4 w-4 text-sage" /> {a}
                  </li>
                ))}
              </ul>
            )}

            {tab === "Espaço de Trabalho" && (
              <div className="space-y-6">
                <div>
                  <h3 className="flex items-center gap-2 font-title font-bold text-ink">
                    <Wifi className="h-5 w-5 text-champagne-600" /> No imóvel
                  </h3>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {property.workFeatures.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-ink">
                        <Check className="h-4 w-4 text-champagne-600" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-title font-bold text-ink">Espaços de trabalho próximos</h3>
                  <ul className="mt-3 space-y-2">
                    {property.nearbyWorkspaces.map((w) => {
                      const Icon = WORKSPACE_ICONS[w.type];
                      return (
                        <li
                          key={w.name}
                          className="flex items-center justify-between rounded-xl border border-sage-200 px-4 py-3"
                        >
                          <span className="flex items-center gap-3 text-sm">
                            <Icon className="h-5 w-5 text-sage" />
                            <span>
                              <span className="font-medium text-ink">{w.name}</span>
                              <span className="block text-xs text-muted">
                                {WORKSPACE_LABEL[w.type]}
                              </span>
                            </span>
                          </span>
                          <span className="text-sm text-muted">{w.distanceM} m</span>
                        </li>
                      );
                    })}
                  </ul>
                  <PropertyMap
                    className="mt-4 aspect-[16/9] w-full"
                    center={{ lat: property.lat, lng: property.lng }}
                    markers={[propertyMarker, ...workspaceMarkers]}
                    placeholderLabel="[MAPA — imóvel + coworkings e salas próximas]"
                  />
                </div>
              </div>
            )}

            {tab === "Disponibilidade" && (
              <div className="rounded-xl border border-sage-200 p-5">
                <p className="text-sm text-muted">Período mínimo de locação</p>
                <p className="font-title text-2xl font-bold text-forest">
                  {property.minPeriodDays} dias
                </p>
                <p className="mt-2 text-sm text-muted">
                  Disponível para locação por temporada de 30 a 180 dias. Converse com o
                  proprietário para confirmar as datas.
                </p>
              </div>
            )}

            {tab === "Localização" && (
              <PropertyMap
                className="aspect-[16/9] w-full"
                center={{ lat: property.lat, lng: property.lng }}
                markers={[propertyMarker]}
                placeholderLabel={`[MAPA — ${property.neighborhood}, ${property.city}]`}
              />
            )}

            {tab === "Proprietário" && (
              <div className="flex items-center gap-4 rounded-xl border border-sage-200 p-5">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-sage-100 font-title text-lg font-bold text-forest">
                  {property.ownerName.charAt(0)}
                </div>
                <div>
                  <p className="font-title font-bold text-ink">{property.ownerName}</p>
                  <p className="text-sm text-muted">Proprietário verificado · responde rápido</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Coluna lateral sticky */}
        <aside className="lg:col-span-1">
          <div className="sticky top-20 rounded-2xl border border-sage-200 bg-white p-6 shadow-sm">
            <div className="flex items-baseline gap-1">
              <span className="font-title text-3xl font-extrabold text-forest">
                {formatBRL(property.monthlyPrice)}
              </span>
              <span className="text-muted">/mês</span>
            </div>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-sage">
              <span className="h-2 w-2 rounded-full bg-sage" /> Disponível agora
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <ButtonLink href="/dashboard/fechamento" variant="gold" className="w-full">
                <FileSignature className="h-4 w-4" /> Candidatar-se
              </ButtonLink>
              <Button variant="outline" className="w-full">
                <MessageSquare className="h-4 w-4" /> Enviar consulta
              </Button>
              <Button variant="ghost" className="w-full">
                <CalendarCheck className="h-4 w-4" /> Agendar visita
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-muted">
              O pagamento do aluguel é feito direto ao proprietário. A plataforma conecta e
              documenta — não intermedeia a transação.
            </p>
          </div>
        </aside>
      </div>

      {/* Similares */}
      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="font-title text-2xl font-extrabold text-ink">Imóveis similares</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
