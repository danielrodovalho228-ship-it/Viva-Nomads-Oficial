"use client";

import { useEffect, useState } from "react";
import { HeartPulse, GraduationCap, Briefcase, ShoppingCart, Bus, MapPin, Maximize2, X } from "lucide-react";
import type { ProximityCategory, Property } from "@/lib/types";
import type { MapMarker } from "@/components/property-map";
import { PropertyMap } from "@/components/property-map-lazy";
import { distanciaAprox, proximidadesDoImovel } from "@/lib/anuncio/proximidades";
import { ServicosPorPerto } from "@/components/property/servicos-por-perto";
import { TempoAte } from "@/components/property/tempo-ate";

const PROXIMITY_META: Record<ProximityCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  saude: { label: "Saúde", icon: HeartPulse },
  educacao: { label: "Educação", icon: GraduationCap },
  trabalho: { label: "Trabalho", icon: Briefcase },
  mercado: { label: "Mercado", icon: ShoppingCart },
  transporte: { label: "Transporte", icon: Bus },
};

/**
 * Localização: mapa da REGIÃO aproximada (endereço exato só após o aceite — regra
 * de privacidade preservada) + lista de proximidades úteis. Se não houver
 * proximidades cadastradas, mostra só o mapa e o aviso de privacidade.
 */
export function LocationNearby({ property }: { property: Property }) {
  const marker: MapMarker = {
    id: property.id,
    lat: property.lat,
    lng: property.lng,
    label: "Imóvel",
    kind: "property",
  };
  // Antes do aceite, limitamos os POIs exibidos para não re-identificar o
  // endereço por combinação (item 4 do QA): no máximo 4, sem a lista completa.
  const MAX_POIS_PUBLICOS = 4;
  const todosProximities = proximidadesDoImovel(property);
  const proximities = todosProximities.slice(0, MAX_POIS_PUBLICOS);
  const ocultos = todosProximities.length - proximities.length;
  const hasProximities = proximities.length > 0;
  // Mapa em tela cheia (ordem d943f893): mesma área aproximada, maior; Esc ou × fecha.
  const [cheio, setCheio] = useState(false);
  useEffect(() => {
    if (!cheio) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setCheio(false);
    document.addEventListener("keydown", esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = antes;
    };
  }, [cheio]);

  return (
    <section aria-labelledby="localizacao-title">
      <h2 id="localizacao-title" className="font-title text-2xl font-semibold text-ink">
        Localização
      </h2>

      <div className="relative mt-4">
        <PropertyMap
          className="aspect-[16/9] w-full"
          center={{ lat: property.lat, lng: property.lng }}
          markers={[marker]}
          approximate
        />
        <button
          type="button"
          onClick={() => setCheio(true)}
          data-testid="ampliar-mapa"
          className="absolute right-3 top-3 z-[5] inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold text-ink hover:bg-white"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Ampliar mapa
        </button>
      </div>
      {cheio && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mapa da região aproximada"
          data-testid="mapa-tela-cheia"
          className="fixed inset-0 z-[90] bg-night/60 p-0 sm:p-6"
          onClick={() => setCheio(false)}
        >
          <div className="relative h-full w-full overflow-hidden bg-white sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <PropertyMap
              className="h-full w-full"
              center={{ lat: property.lat, lng: property.lng }}
              markers={[marker]}
              approximate
            />
            <button
              type="button"
              onClick={() => setCheio(false)}
              aria-label="Fechar mapa"
              className="absolute right-3 top-3 z-[5] grid h-10 w-10 place-items-center rounded-full bg-white text-ink "
            >
              <X className="h-5 w-5" />
            </button>
            <p className="absolute inset-x-3 bottom-3 z-[5] rounded-xl bg-white/95 px-3 py-2 text-xs text-muted ">
              Área aproximada de {property.neighborhood}. O endereço exato é liberado após o aceite da candidatura.
            </p>
          </div>
        </div>
      )}
      <p className="mt-3 flex items-start gap-2 text-sm text-muted">
        <MapPin className="mt-1 h-4 w-4 shrink-0" />
        <span>
          Mostramos a <strong className="text-ink">região aproximada</strong> ({property.neighborhood}). O endereço
          exato é liberado após o aceite da candidatura.
        </span>
      </p>

      {hasProximities && (
        <>
          <h3 className="mt-6 text-sm font-semibold text-forest">O que tem por perto</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {proximities.map((p) => {
              const meta = PROXIMITY_META[p.category];
              const Icon = meta?.icon ?? MapPin;
              const dist = distanciaAprox(p.note);
              return (
                <li
                  key={`${p.category}-${p.name}`}
                  className="flex items-center gap-3 rounded-xl border border-sage-200 px-4 py-3"
                >
                  <Icon className="h-5 w-5 shrink-0 text-sage" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{p.name}</span>
                    <span className="block text-xs text-muted">
                      {meta?.label ?? p.category}
                      {dist ? ` · ${dist}` : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          {ocultos > 0 && (
            <p className="mt-2 text-xs text-muted">
              +{ocultos} ponto(s) de interesse revelados após o aceite da candidatura.
            </p>
          )}
        </>
      )}
      <ServicosPorPerto proximidades={todosProximities} />
      <TempoAte imovelId={property.id} />
    </section>
  );
}
